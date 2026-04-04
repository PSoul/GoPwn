import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockProject, MOCK_REVIEW_RESPONSE } from "./_helpers"

const mockLlmChat = vi.hoisted(() => vi.fn())

vi.mock("@/lib/repositories/project-repo", () => ({
  findById: vi.fn(),
  updateLifecycle: vi.fn().mockResolvedValue({}),
}))
vi.mock("@/lib/repositories/mcp-run-repo", () => ({
  findByProjectAndRound: vi.fn().mockResolvedValue([
    { status: "succeeded", toolName: "fscan_port_scan", target: "127.0.0.1", rawOutput: "scan results" },
  ]),
  findByProject: vi.fn().mockResolvedValue([]),
}))
vi.mock("@/lib/repositories/asset-repo", () => ({
  countByProject: vi.fn().mockResolvedValue(5),
  findByProject: vi.fn().mockResolvedValue([]),
}))
vi.mock("@/lib/repositories/finding-repo", () => ({
  findByProject: vi.fn().mockResolvedValue([]),
}))
vi.mock("@/lib/repositories/audit-repo", () => ({ create: vi.fn() }))
vi.mock("@/lib/infra/prisma", () => ({
  prisma: {
    orchestratorRound: { update: vi.fn().mockResolvedValue({}) },
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
import { handleRoundCompleted, handleSettleClosure } from "@/lib/workers/lifecycle-worker"

describe("lifecycle-worker: handleRoundCompleted", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLlmChat.mockResolvedValue({
      content: MOCK_REVIEW_RESPONSE,
      provider: "test-provider", model: "test-model", durationMs: 1000,
    })
  })

  it("reviewer 决定 continue → 发布 plan_round", async () => {
    vi.mocked(projectRepo.findById).mockResolvedValue(mockProject({ lifecycle: "executing" }) as never)

    await handleRoundCompleted({ projectId: "proj-test-001", round: 1 })

    expect(mockLlmChat).toHaveBeenCalledTimes(1)
    const { createPgBossJobQueue } = await import("@/lib/infra/job-queue")
    const queue = createPgBossJobQueue()
    expect(queue.publish).toHaveBeenCalledWith("plan_round", expect.objectContaining({ round: 2 }))
  })

  it("reviewer 决定 settle → 发布 settle_closure", async () => {
    vi.mocked(projectRepo.findById).mockResolvedValue(mockProject({ lifecycle: "executing" }) as never)
    mockLlmChat.mockResolvedValueOnce({
      content: JSON.stringify({ decision: "settle", reasoning: "已充分覆盖" }),
      provider: "test", model: "test", durationMs: 500,
    })

    await handleRoundCompleted({ projectId: "proj-test-001", round: 1 })

    const { createPgBossJobQueue } = await import("@/lib/infra/job-queue")
    const queue = createPgBossJobQueue()
    expect(queue.publish).toHaveBeenCalledWith("settle_closure", expect.objectContaining({ projectId: "proj-test-001" }))
  })

  it("最后一轮强制 settle", async () => {
    vi.mocked(projectRepo.findById).mockResolvedValue(mockProject({ lifecycle: "executing", maxRounds: 3 }) as never)
    // Even if reviewer says continue, maxRounds should force settle
    mockLlmChat.mockResolvedValueOnce({
      content: JSON.stringify({ decision: "continue", nextPhase: "assessment", reasoning: "继续" }),
      provider: "test", model: "test", durationMs: 500,
    })

    await handleRoundCompleted({ projectId: "proj-test-001", round: 3 })

    const { createPgBossJobQueue } = await import("@/lib/infra/job-queue")
    const queue = createPgBossJobQueue()
    expect(queue.publish).toHaveBeenCalledWith("settle_closure", expect.objectContaining({ projectId: "proj-test-001" }))
  })

  it("项目已停止：跳过审阅", async () => {
    vi.mocked(projectRepo.findById).mockResolvedValue(mockProject({ lifecycle: "stopped" }) as never)

    await handleRoundCompleted({ projectId: "proj-test-001", round: 1 })

    expect(mockLlmChat).not.toHaveBeenCalled()
  })
})

describe("lifecycle-worker: handleSettleClosure", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("生成报告 → 项目 completed", async () => {
    vi.mocked(projectRepo.findById).mockResolvedValue(mockProject({ lifecycle: "settling", currentRound: 3 }) as never)

    await handleSettleClosure({ projectId: "proj-test-001" })

    expect(projectRepo.updateLifecycle).toHaveBeenCalled()
  })
})
