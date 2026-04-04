import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockProject, MOCK_PLAN_RESPONSE } from "./_helpers"

const mockLlmChat = vi.hoisted(() => vi.fn())

vi.mock("@/lib/repositories/project-repo", () => ({
  findById: vi.fn(),
  updateLifecycle: vi.fn(),
  updatePhaseAndRound: vi.fn(),
}))
vi.mock("@/lib/repositories/asset-repo", () => ({ findByProject: vi.fn().mockResolvedValue([]) }))
vi.mock("@/lib/repositories/finding-repo", () => ({ findByProject: vi.fn().mockResolvedValue([]) }))
vi.mock("@/lib/repositories/mcp-run-repo", () => ({
  findByProjectAndRound: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue({ id: "run-001" }),
  updateStatus: vi.fn(),
}))
vi.mock("@/lib/repositories/mcp-tool-repo", () => ({
  findEnabled: vi.fn().mockResolvedValue([{ toolName: "fscan_port_scan", capability: "port_scanning", description: "Scan ports" }]),
  findByToolName: vi.fn().mockResolvedValue({ id: "tool-001", capability: "port_scanning", requiresApproval: false }),
}))
vi.mock("@/lib/repositories/approval-repo", () => ({ create: vi.fn() }))
vi.mock("@/lib/repositories/audit-repo", () => ({ create: vi.fn() }))
vi.mock("@/lib/infra/prisma", () => ({
  prisma: {
    orchestratorRound: { upsert: vi.fn(), update: vi.fn() },
    orchestratorPlan: { upsert: vi.fn() },
    globalConfig: { findUnique: vi.fn().mockResolvedValue({ approvalEnabled: false, autoApproveLowRisk: true, autoApproveMediumRisk: false }) },
  },
}))
vi.mock("@/lib/infra/event-bus", () => ({ publishEvent: vi.fn() }))
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

vi.mock("@/lib/llm", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    getLlmProvider: vi.fn().mockResolvedValue({ chat: mockLlmChat }),
  }
})

import * as projectRepo from "@/lib/repositories/project-repo"
import { handlePlanRound } from "@/lib/workers/planning-worker"

describe("planning-worker", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLlmChat.mockResolvedValue({
      content: MOCK_PLAN_RESPONSE,
      provider: "test-provider", model: "test-model", durationMs: 1000,
    })
  })

  it("正常路径：生成计划并发布 execute_tool job", async () => {
    vi.mocked(projectRepo.findById).mockResolvedValue(mockProject({ lifecycle: "planning" }) as never)

    await handlePlanRound({ projectId: "proj-test-001", round: 1 })

    expect(projectRepo.updateLifecycle).toHaveBeenCalled()
    expect(mockLlmChat).toHaveBeenCalledTimes(1)
  })

  it("项目已停止：跳过规划", async () => {
    vi.mocked(projectRepo.findById).mockResolvedValue(mockProject({ lifecycle: "stopped" }) as never)

    await handlePlanRound({ projectId: "proj-test-001", round: 1 })

    expect(mockLlmChat).not.toHaveBeenCalled()
  })

  it("项目不存在：静默返回", async () => {
    vi.mocked(projectRepo.findById).mockResolvedValue(null as never)

    await handlePlanRound({ projectId: "non-existent", round: 1 })

    expect(mockLlmChat).not.toHaveBeenCalled()
  })

  it("LLM 失败：抛出异常让 pg-boss 重试", async () => {
    vi.mocked(projectRepo.findById).mockResolvedValue(mockProject({ lifecycle: "planning" }) as never)
    mockLlmChat.mockRejectedValueOnce(new Error("LLM timeout"))

    await expect(handlePlanRound({ projectId: "proj-test-001", round: 1 })).rejects.toThrow("LLM timeout")
  })

  it("LLM 返回空计划：发布 round_completed", async () => {
    vi.mocked(projectRepo.findById).mockResolvedValue(mockProject({ lifecycle: "planning" }) as never)
    mockLlmChat.mockResolvedValueOnce({
      content: JSON.stringify({ summary: "无需执行", phase: "recon", items: [] }),
      provider: "test", model: "test", durationMs: 500,
    })

    await handlePlanRound({ projectId: "proj-test-001", round: 1 })

    const { createPgBossJobQueue } = await import("@/lib/infra/job-queue")
    const queue = createPgBossJobQueue()
    expect(queue.publish).toHaveBeenCalledWith("round_completed", expect.objectContaining({ projectId: "proj-test-001" }))
  })
})
