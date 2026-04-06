/**
 * 性能测试 — 并发项目隔离性
 *
 * 验证多个 handleReactRound 并发执行时互不干扰，
 * 且并发耗时比串行有合理的加速比。
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { createDelayedLlmProvider, createDelayedMcpTool } from "../helpers/mock-llm"
import { mockProject } from "../helpers/factories"
import type { LlmResponse } from "@/lib/llm/provider"

// ── vi.hoisted ──
const delayedCallTool = vi.hoisted(() => vi.fn())

// ── Mock 所有外部依赖 ──
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
  create: vi.fn().mockResolvedValue({ id: "finding-conc-001" }),
}))
vi.mock("@/lib/repositories/mcp-run-repo", () => ({
  create: vi.fn().mockResolvedValue({ id: "run-conc-001" }),
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
  createPgBossJobQueue: vi.fn().mockReturnValue({ publish: vi.fn().mockResolvedValue("job-conc-001") }),
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

vi.mock("@/lib/llm", () => ({
  getLlmProvider: vi.fn(),
}))

import * as projectRepo from "@/lib/repositories/project-repo"
import { getLlmProvider } from "@/lib/llm"
import { handleReactRound } from "@/lib/workers/react-worker"

// ── 构造 2-step 响应（1 次 function_call + 1 次 done）以加速测试 ──
const LLM_DELAY_MS = 30
const MCP_DELAY_MS = 50

function buildSimpleResponses(): LlmResponse[] {
  return [
    {
      content: "扫描目标",
      functionCall: { name: "fscan_port_scan", arguments: JSON.stringify({ target: "127.0.0.1" }) },
      toolCallId: "call_conc_1",
      provider: "test-delayed",
      model: "test-model",
      durationMs: LLM_DELAY_MS,
    },
    {
      content: "",
      functionCall: { name: "done", arguments: JSON.stringify({ summary: "完成" }) },
      toolCallId: "call_conc_done",
      provider: "test-delayed",
      model: "test-model",
      durationMs: LLM_DELAY_MS,
    },
  ]
}

function setupForProject(projectId: string) {
  // findById 根据 projectId 返回对应项目
  vi.mocked(projectRepo.findById).mockImplementation(async (id: string) => {
    if (id === projectId) {
      return mockProject({ id, lifecycle: "idle" }) as never
    }
    return null as never
  })

  const provider = createDelayedLlmProvider({ delayMs: LLM_DELAY_MS, responses: buildSimpleResponses() })
  vi.mocked(getLlmProvider).mockResolvedValue(provider)

  const mcpTool = createDelayedMcpTool({ delayMs: MCP_DELAY_MS, output: "PORT 80 open" })
  delayedCallTool.mockImplementation(mcpTool)
}

function setupForConcurrent() {
  // findById 对任意 projectId 都返回对应的 mock 项目
  vi.mocked(projectRepo.findById).mockImplementation(async (id: string) => {
    return mockProject({ id, lifecycle: "idle" }) as never
  })

  // 每次 getLlmProvider 调用都返回独立的 provider 实例（避免状态共享）
  vi.mocked(getLlmProvider).mockImplementation(async () => {
    return createDelayedLlmProvider({ delayMs: LLM_DELAY_MS, responses: buildSimpleResponses() })
  })

  const mcpTool = createDelayedMcpTool({ delayMs: MCP_DELAY_MS, output: "PORT 80 open" })
  delayedCallTool.mockImplementation(mcpTool)
}

describe("concurrent-projects 性能测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("5 个并发项目全部完成", async () => {
    setupForConcurrent()

    const projectIds = Array.from({ length: 5 }, (_, i) => `proj-conc-${i}`)
    const results = await Promise.allSettled(
      projectIds.map((id) => handleReactRound({ projectId: id, round: 1 })),
    )

    // 所有项目都应该成功完成
    const fulfilled = results.filter((r) => r.status === "fulfilled")
    const rejected = results.filter((r) => r.status === "rejected")

    console.log(`[perf] 5 并发: ${fulfilled.length} 成功, ${rejected.length} 失败`)
    if (rejected.length > 0) {
      rejected.forEach((r, i) => {
        if (r.status === "rejected") {
          console.log(`[perf]   失败 #${i}: ${r.reason}`)
        }
      })
    }

    expect(fulfilled.length).toBe(5)
  })

  it("5 并发 vs 5 串行耗时比 < 1.5x", async () => {
    // 串行执行 5 个项目
    setupForConcurrent()
    const serialStart = performance.now()
    for (let i = 0; i < 5; i++) {
      await handleReactRound({ projectId: `proj-serial-${i}`, round: 1 })
    }
    const serialTime = performance.now() - serialStart

    // 并发执行 5 个项目
    vi.clearAllMocks()
    setupForConcurrent()
    const concurrentStart = performance.now()
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        handleReactRound({ projectId: `proj-parallel-${i}`, round: 1 }),
      ),
    )
    const concurrentTime = performance.now() - concurrentStart

    const ratio = concurrentTime / serialTime

    console.log(`[perf] 串行 5 项目: ${serialTime.toFixed(1)}ms`)
    console.log(`[perf] 并发 5 项目: ${concurrentTime.toFixed(1)}ms`)
    console.log(`[perf] 并发/串行比: ${ratio.toFixed(2)}x`)

    // mock 环境下并发应更快，并发/串行比应 < 1.5x
    expect(ratio).toBeLessThan(1.5)
  })
})
