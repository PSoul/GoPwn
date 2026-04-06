import { describe, it, expect, vi, beforeEach } from "vitest"
import { MOCK_ANALYSIS_RESPONSE } from "../../helpers/factories"

const mockLlmChat = vi.hoisted(() => vi.fn())

vi.mock("@/lib/repositories/asset-repo", () => ({
  findByProject: vi.fn().mockResolvedValue([]),
  upsert: vi.fn().mockResolvedValue({ id: "asset-001" }),
  addFingerprint: vi.fn(),
}))
vi.mock("@/lib/repositories/evidence-repo", () => ({
  create: vi.fn().mockResolvedValue({ id: "evidence-001" }),
}))
vi.mock("@/lib/repositories/finding-repo", () => ({
  findByProject: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue({ id: "finding-001" }),
}))
vi.mock("@/lib/repositories/audit-repo", () => ({ create: vi.fn() }))
vi.mock("@/lib/infra/event-bus", () => ({ publishEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@/lib/infra/job-queue", () => ({
  createPgBossJobQueue: vi.fn().mockReturnValue({ publish: vi.fn().mockResolvedValue("job-001") }),
}))
vi.mock("@/lib/infra/abort-registry", () => ({ registerAbort: vi.fn(), unregisterAbort: vi.fn() }))
vi.mock("@/lib/infra/pipeline-logger", () => ({
  createPipelineLogger: vi.fn().mockReturnValue({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    startTimer: () => ({ elapsed: () => 1000 }),
  }),
}))
vi.mock("@/lib/infra/prisma", () => ({
  prisma: {
    project: { findUnique: vi.fn().mockResolvedValue({ name: "Test", lifecycle: "executing" }) },
    mcpRun: { findUnique: vi.fn().mockResolvedValue({ round: 1 }) },
    orchestratorRound: { update: vi.fn().mockResolvedValue({}) },
  },
}))

vi.mock("@/lib/llm", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    getLlmProvider: vi.fn().mockResolvedValue({ chat: mockLlmChat }),
  }
})

import * as evidenceRepo from "@/lib/repositories/evidence-repo"
import * as assetRepo from "@/lib/repositories/asset-repo"
import * as findingRepo from "@/lib/repositories/finding-repo"
import { prisma } from "@/lib/infra/prisma"
import { handleAnalyzeResult } from "@/lib/workers/analysis-worker"

describe("analysis-worker", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLlmChat.mockResolvedValue({
      content: MOCK_ANALYSIS_RESPONSE,
      provider: "test-provider", model: "test-model", durationMs: 1000,
    })
  })

  it("正常路径：LLM 分析 → 创建 assets + findings + evidence", async () => {
    await handleAnalyzeResult({
      projectId: "proj-test-001",
      mcpRunId: "run-001",
      rawOutput: '{"ports": [80]}',
      toolName: "fscan_port_scan",
      target: "127.0.0.1",
    })

    expect(mockLlmChat).toHaveBeenCalledTimes(1)
    expect(evidenceRepo.create).toHaveBeenCalled()
    expect(assetRepo.upsert).toHaveBeenCalled()
    expect(findingRepo.create).toHaveBeenCalled()
  })

  it("LLM 失败 → 仍保存 raw evidence（fallback）", async () => {
    mockLlmChat.mockRejectedValueOnce(new Error("LLM error"))

    await expect(handleAnalyzeResult({
      projectId: "proj-test-001",
      mcpRunId: "run-001",
      rawOutput: "some output",
      toolName: "fscan_port_scan",
      target: "127.0.0.1",
    })).rejects.toThrow("LLM error")

    // Fallback evidence should still be created
    expect(evidenceRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringContaining("analysis failed"),
    }))
  })

  it("项目已停止 → 跳过分析", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce({ name: "Test", lifecycle: "stopped" } as never)

    await handleAnalyzeResult({
      projectId: "proj-test-001",
      mcpRunId: "run-001",
      rawOutput: "output",
      toolName: "fscan_port_scan",
      target: "127.0.0.1",
    })

    expect(mockLlmChat).not.toHaveBeenCalled()
  })

  it("LLM 返回空结果 → 只创建 evidence，0 assets/findings", async () => {
    mockLlmChat.mockResolvedValueOnce({
      content: JSON.stringify({ assets: [], findings: [], evidenceSummary: "No results" }),
      provider: "test", model: "test", durationMs: 500,
    })

    await handleAnalyzeResult({
      projectId: "proj-test-001",
      mcpRunId: "run-001",
      rawOutput: "empty scan",
      toolName: "fscan_port_scan",
      target: "127.0.0.1",
    })

    expect(evidenceRepo.create).toHaveBeenCalled()
    expect(assetRepo.upsert).not.toHaveBeenCalled()
    expect(findingRepo.create).not.toHaveBeenCalled()
  })

  it("重复 finding 去重：已有相同标题+目标的 finding 时传递给 LLM 上下文", async () => {
    // 模拟已存在一个 finding
    const existingFinding = {
      title: "Open HTTP Port",
      severity: "info",
      affectedTarget: "127.0.0.1:80",
    }
    vi.mocked(findingRepo.findByProject).mockResolvedValueOnce([existingFinding] as never)

    // LLM 返回相同的 finding（LLM 应通过上下文感知已存在的 findings 来去重）
    mockLlmChat.mockResolvedValueOnce({
      content: JSON.stringify({
        assets: [],
        findings: [{ title: "Open HTTP Port", severity: "info", affectedTarget: "127.0.0.1:80", summary: "same port", recommendation: "" }],
        evidenceSummary: "Port 80 open",
      }),
      provider: "test", model: "test", durationMs: 500,
    })

    await handleAnalyzeResult({
      projectId: "proj-test-001",
      mcpRunId: "run-002",
      rawOutput: "port 80 open",
      toolName: "fscan_port_scan",
      target: "127.0.0.1",
    })

    // 验证 LLM 调用时传入了 existingFindings（去重依赖 LLM 的上下文感知）
    const llmCallArgs = mockLlmChat.mock.calls[0]
    const prompt = llmCallArgs[0].map((m: { content: string }) => m.content).join("\n")
    expect(prompt).toContain("Open HTTP Port")

    // 验证 findingRepo.create 被调用时传入了正确的字段
    expect(findingRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      title: "Open HTTP Port",
      severity: "info",
      affectedTarget: "127.0.0.1:80",
    }))
  })

  it("非 info 级别的 finding 会排队验证", async () => {
    mockLlmChat.mockResolvedValueOnce({
      content: JSON.stringify({
        assets: [],
        findings: [
          { title: "SQL Injection", severity: "high", affectedTarget: "127.0.0.1/login", summary: "found sqli", recommendation: "fix" },
        ],
        evidenceSummary: "Found sqli",
      }),
      provider: "test", model: "test", durationMs: 500,
    })

    await handleAnalyzeResult({
      projectId: "proj-test-001",
      mcpRunId: "run-003",
      rawOutput: "sql error",
      toolName: "sqlmap_scan",
      target: "127.0.0.1",
    })

    const { createPgBossJobQueue } = await import("@/lib/infra/job-queue")
    const queue = createPgBossJobQueue()
    expect(queue.publish).toHaveBeenCalledWith("verify_finding", expect.objectContaining({
      projectId: "proj-test-001",
    }))
  })
})
