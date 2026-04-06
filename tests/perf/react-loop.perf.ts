/**
 * 性能测试 — 单轮 ReAct 吞吐量
 *
 * 验证 handleReactRound 在 mock 依赖下的框架开销合理。
 * Mock 延迟：LLM 50ms×4 + MCP 100ms×3 = 500ms，框架开销应远低于阈值。
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { createDelayedLlmProvider, createDelayedMcpTool } from "../helpers/mock-llm"
import { mockProject } from "../helpers/factories"
import type { LlmResponse } from "@/lib/llm/provider"

// ── vi.hoisted: 提升 mock 引用到模块顶部 ──
const delayedCallTool = vi.hoisted(() => vi.fn())

// ── Mock 所有外部依赖（同单元测试） ──
vi.mock("@/lib/repositories/project-repo", () => ({
  findById: vi.fn(),
  updateLifecycle: vi.fn().mockResolvedValue({}),
  updatePhaseAndRound: vi.fn().mockResolvedValue({}),
}))
vi.mock("@/lib/repositories/asset-repo", () => ({
  findByProject: vi.fn().mockResolvedValue([]),
}))
vi.mock("@/lib/repositories/finding-repo", () => ({
  findByProject: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue({ id: "finding-perf-001" }),
}))
vi.mock("@/lib/repositories/mcp-run-repo", () => ({
  create: vi.fn().mockResolvedValue({ id: "run-perf-001" }),
  updateStatus: vi.fn().mockResolvedValue({}),
}))
vi.mock("@/lib/repositories/mcp-tool-repo", () => ({
  findEnabled: vi.fn().mockResolvedValue([
    { id: "tool-001", toolName: "fscan_port_scan", description: "端口扫描", capability: "port_scanning", riskLevel: "low", inputSchema: { properties: { target: { type: "string" } } } },
  ]),
  findByToolName: vi.fn().mockResolvedValue({ id: "tool-001", toolName: "fscan_port_scan", capability: "port_scanning", riskLevel: "low" }),
}))
vi.mock("@/lib/repositories/audit-repo", () => ({ create: vi.fn() }))

vi.mock("@/lib/infra/prisma", () => ({
  prisma: {
    orchestratorRound: {
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}))
vi.mock("@/lib/infra/event-bus", () => ({ publishEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@/lib/infra/job-queue", () => ({
  createPgBossJobQueue: vi.fn().mockReturnValue({ publish: vi.fn().mockResolvedValue("job-perf-001") }),
}))
vi.mock("@/lib/infra/abort-registry", () => ({
  registerAbort: vi.fn(),
  unregisterAbort: vi.fn(),
}))
vi.mock("@/lib/infra/pipeline-logger", () => ({
  createPipelineLogger: vi.fn().mockReturnValue({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    startTimer: () => ({ elapsed: () => 0 }),
  }),
}))

vi.mock("@/lib/llm/react-prompt", () => ({
  buildReactSystemPrompt: vi.fn().mockResolvedValue("你是一个渗透测试 AI 助手"),
}))
vi.mock("@/lib/llm/function-calling", () => ({
  mcpToolsToFunctions: vi.fn().mockReturnValue([
    { name: "fscan_port_scan", description: "端口扫描", parameters: { type: "object", properties: { target: { type: "string" } } } },
  ]),
  getControlFunctions: vi.fn().mockReturnValue([
    { name: "done", description: "结束当前轮次", parameters: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] } },
    { name: "report_finding", description: "报告发现", parameters: { type: "object", properties: { title: { type: "string" } }, required: ["title"] } },
  ]),
}))
vi.mock("@/lib/llm/tool-input-mapper", () => ({
  buildToolInputFromFunctionArgs: vi.fn().mockResolvedValue({ target: "127.0.0.1" }),
}))
vi.mock("@/lib/domain/scope-policy", () => ({
  createScopePolicy: vi.fn().mockReturnValue({
    isInScope: vi.fn().mockReturnValue(true),
    describe: vi.fn().mockReturnValue("127.0.0.1/24"),
  }),
}))

vi.mock("@/lib/mcp", () => ({
  callTool: (...args: unknown[]) => delayedCallTool(...args),
}))

// ── 构造预设 LLM 响应：3 次 function_call + 1 次 done ──
function buildLlmResponses(delayMs: number): LlmResponse[] {
  const fnCall = (step: number): LlmResponse => ({
    content: `思考第 ${step} 步`,
    functionCall: {
      name: "fscan_port_scan",
      arguments: JSON.stringify({ target: "127.0.0.1", ports: `${step * 1000}-${step * 1000 + 999}` }),
    },
    toolCallId: `call_perf_${step}`,
    provider: "test-delayed",
    model: "test-model",
    durationMs: delayMs,
  })

  const doneCall: LlmResponse = {
    content: "",
    functionCall: {
      name: "done",
      arguments: JSON.stringify({ summary: "扫描完成，共执行 3 步" }),
    },
    toolCallId: "call_perf_done",
    provider: "test-delayed",
    model: "test-model",
    durationMs: delayMs,
  }

  return [fnCall(1), fnCall(2), fnCall(3), doneCall]
}

// ── 配置 LLM provider mock ──
const LLM_DELAY_MS = 50
const MCP_DELAY_MS = 100

vi.mock("@/lib/llm", () => {
  // 注意：每次 getLlmProvider 调用返回一个新的 provider 实例，避免状态污染
  return {
    getLlmProvider: vi.fn(),
  }
})

import * as projectRepo from "@/lib/repositories/project-repo"
import { getLlmProvider } from "@/lib/llm"
import { handleReactRound } from "@/lib/workers/react-worker"

// ── 辅助函数 ──
function setupMocks() {
  vi.mocked(projectRepo.findById).mockResolvedValue(
    mockProject({ lifecycle: "idle" }) as never,
  )

  // 每次 getLlmProvider 调用返回独立的 provider 实例（避免状态共享）
  vi.mocked(getLlmProvider).mockImplementation(async () => {
    return createDelayedLlmProvider({ delayMs: LLM_DELAY_MS, responses: buildLlmResponses(LLM_DELAY_MS) })
  })

  // MCP 工具 mock 使用延迟
  const mcpTool = createDelayedMcpTool({ delayMs: MCP_DELAY_MS, output: "PORT 80 open\nPORT 443 open" })
  delayedCallTool.mockImplementation(mcpTool)
}

// ── 性能指标辅助 ──
function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil(sorted.length * p / 100) - 1
  return sorted[Math.max(0, idx)]
}

describe("react-loop 性能测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("单轮 3-step ReAct 框架开销合理 (< 1200ms)", async () => {
    setupMocks()

    const start = performance.now()
    await handleReactRound({ projectId: "proj-perf-001", round: 1 })
    const elapsed = performance.now() - start

    // 预期 mock 延迟：50ms×4 LLM + 100ms×3 MCP = 500ms
    // 框架开销阈值：1500ms（总计 < 2000ms）
    console.log(`[perf] 单轮 3-step ReAct 总耗时: ${elapsed.toFixed(1)}ms (mock 延迟 ~500ms)`)
    console.log(`[perf] 框架开销: ${(elapsed - 500).toFixed(1)}ms`)

    expect(elapsed).toBeLessThan(1200)
  })

  it("连续 10 轮 P50/P95 合理", async () => {
    const times: number[] = []

    for (let i = 0; i < 10; i++) {
      vi.clearAllMocks()
      setupMocks()

      const start = performance.now()
      await handleReactRound({ projectId: `proj-perf-${i}`, round: 1 })
      times.push(performance.now() - start)
    }

    const sorted = [...times].sort((a, b) => a - b)
    const p50 = percentile(sorted, 50)
    const p95 = percentile(sorted, 95)
    const avg = times.reduce((s, t) => s + t, 0) / times.length

    console.log(`[perf] 连续 10 轮统计:`)
    console.log(`[perf]   平均: ${avg.toFixed(1)}ms`)
    console.log(`[perf]   P50:  ${p50.toFixed(1)}ms`)
    console.log(`[perf]   P95:  ${p95.toFixed(1)}ms`)
    console.log(`[perf]   最小: ${sorted[0].toFixed(1)}ms`)
    console.log(`[perf]   最大: ${sorted[sorted.length - 1].toFixed(1)}ms`)

    // P95 应在合理范围内（mock 延迟 500ms，允许合理框架开销）
    expect(p95).toBeLessThan(2000)
    expect(p50).toBeLessThan(1500)
  })
})
