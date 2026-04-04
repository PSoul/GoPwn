import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockFinding } from "./_helpers"

const mockLlmChat = vi.hoisted(() => vi.fn())

vi.mock("@/lib/repositories/finding-repo", () => ({
  findById: vi.fn(),
  updateStatus: vi.fn(),
  createPoc: vi.fn(),
}))
vi.mock("@/lib/repositories/mcp-run-repo", () => ({
  create: vi.fn().mockResolvedValue({ id: "run-poc-001" }),
  updateStatus: vi.fn(),
}))
vi.mock("@/lib/repositories/mcp-tool-repo", () => ({
  findByCapability: vi.fn().mockResolvedValue([{ id: "tool-exec-001", toolName: "execute_code" }]),
}))
vi.mock("@/lib/repositories/audit-repo", () => ({ create: vi.fn() }))
vi.mock("@/lib/infra/prisma", () => ({
  prisma: {
    project: { findUnique: vi.fn().mockResolvedValue({ name: "Test", lifecycle: "executing", currentPhase: "verification", currentRound: 2 }) },
  },
}))
vi.mock("@/lib/infra/event-bus", () => ({ publishEvent: vi.fn() }))
vi.mock("@/lib/infra/abort-registry", () => ({ registerAbort: vi.fn(), unregisterAbort: vi.fn() }))
vi.mock("@/lib/infra/pipeline-logger", () => ({
  createPipelineLogger: vi.fn().mockReturnValue({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    startTimer: () => ({ elapsed: () => 1000 }),
  }),
}))

const MOCK_POC_RESPONSE = JSON.stringify({
  code: "console.log(JSON.stringify({verified: true, detail: 'confirmed'}))",
  language: "javascript",
  description: "Test PoC",
})

vi.mock("@/lib/llm", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    getLlmProvider: vi.fn().mockResolvedValue({ chat: mockLlmChat }),
  }
})

const mockCallTool = vi.fn()
vi.mock("@/lib/mcp", () => ({ callTool: (...args: unknown[]) => mockCallTool(...args) }))

import * as findingRepo from "@/lib/repositories/finding-repo"
import { prisma } from "@/lib/infra/prisma"
import { handleVerifyFinding } from "@/lib/workers/verification-worker"

describe("verification-worker", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLlmChat.mockResolvedValue({
      content: MOCK_POC_RESPONSE,
      provider: "test-provider", model: "test-model", durationMs: 1000,
    })
  })

  it("正常路径：LLM 生成 PoC → 执行 → verified", async () => {
    vi.mocked(findingRepo.findById).mockResolvedValue(mockFinding() as never)
    mockCallTool.mockResolvedValue({ content: '{"verified": true, "detail": "confirmed"}', isError: false })

    await handleVerifyFinding({ projectId: "proj-test-001", findingId: "finding-test-001" })

    expect(findingRepo.updateStatus).toHaveBeenCalledWith("finding-test-001", "verified")
    expect(findingRepo.createPoc).toHaveBeenCalled()
  })

  it("PoC 执行失败 → finding 回退为 suspected", async () => {
    vi.mocked(findingRepo.findById).mockResolvedValue(mockFinding() as never)
    mockCallTool.mockRejectedValue(new Error("execution failed"))

    await expect(handleVerifyFinding({ projectId: "proj-test-001", findingId: "finding-test-001" })).rejects.toThrow()

    expect(findingRepo.updateStatus).toHaveBeenCalledWith("finding-test-001", "suspected")
  })

  it("项目已停止 → 跳过", async () => {
    vi.mocked(findingRepo.findById).mockResolvedValue(mockFinding() as never)
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce({ name: "Test", lifecycle: "stopped" } as never)

    await handleVerifyFinding({ projectId: "proj-test-001", findingId: "finding-test-001" })

    expect(mockCallTool).not.toHaveBeenCalled()
  })

  it("Finding 非 suspected → 跳过", async () => {
    vi.mocked(findingRepo.findById).mockResolvedValue(mockFinding({ status: "verified" }) as never)

    await handleVerifyFinding({ projectId: "proj-test-001", findingId: "finding-test-001" })

    expect(mockCallTool).not.toHaveBeenCalled()
  })
})
