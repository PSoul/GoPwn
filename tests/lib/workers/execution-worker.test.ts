import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockProject, mockMcpRun } from "./_helpers"

vi.mock("@/lib/repositories/project-repo", () => ({
  findById: vi.fn(),
}))
vi.mock("@/lib/repositories/mcp-run-repo", () => ({
  findById: vi.fn(),
  findByProjectAndRound: vi.fn().mockResolvedValue([]),
  updateStatus: vi.fn(),
}))
vi.mock("@/lib/repositories/mcp-tool-repo", () => ({
  findByToolName: vi.fn().mockResolvedValue({ id: "tool-001", inputSchema: { properties: { target: { type: "string" } } } }),
}))
vi.mock("@/lib/infra/event-bus", () => ({ publishEvent: vi.fn() }))
vi.mock("@/lib/infra/job-queue", () => ({
  createPgBossJobQueue: vi.fn().mockReturnValue({ publish: vi.fn().mockResolvedValue("job-001") }),
}))
vi.mock("@/lib/infra/pipeline-logger", () => ({
  createPipelineLogger: vi.fn().mockReturnValue({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    startTimer: () => ({ elapsed: () => 1000 }),
  }),
}))

const mockCallTool = vi.fn()
vi.mock("@/lib/mcp", () => ({ callTool: (...args: unknown[]) => mockCallTool(...args) }))

import * as projectRepo from "@/lib/repositories/project-repo"
import * as mcpRunRepo from "@/lib/repositories/mcp-run-repo"
import { handleExecuteTool } from "@/lib/workers/execution-worker"

describe("execution-worker", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("正常路径：工具成功 → 存 rawOutput → 发布 analyze_result", async () => {
    vi.mocked(mcpRunRepo.findById).mockResolvedValue(mockMcpRun() as never)
    vi.mocked(projectRepo.findById).mockResolvedValue(mockProject({ lifecycle: "executing" }) as never)
    vi.mocked(mcpRunRepo.findByProjectAndRound).mockResolvedValue([mockMcpRun({ status: "succeeded" })] as never)
    mockCallTool.mockResolvedValue({ content: '{"ports": [80, 443]}', isError: false, durationMs: 2000 })

    await handleExecuteTool({ projectId: "proj-test-001", mcpRunId: "run-test-001" })

    expect(mcpRunRepo.updateStatus).toHaveBeenCalledWith("run-test-001", "succeeded", expect.objectContaining({ rawOutput: expect.any(String) }))
    const { createPgBossJobQueue } = await import("@/lib/infra/job-queue")
    const queue = createPgBossJobQueue()
    expect(queue.publish).toHaveBeenCalledWith("analyze_result", expect.objectContaining({ mcpRunId: "run-test-001" }))
  })

  it("工具返回 isError → 标记 failed，有输出时仍尝试分析", async () => {
    vi.mocked(mcpRunRepo.findById).mockResolvedValue(mockMcpRun() as never)
    vi.mocked(projectRepo.findById).mockResolvedValue(mockProject({ lifecycle: "executing" }) as never)
    vi.mocked(mcpRunRepo.findByProjectAndRound).mockResolvedValue([mockMcpRun({ status: "failed" })] as never)
    mockCallTool.mockResolvedValue({ content: "Error: connection refused but partial scan results here...", isError: true })

    await handleExecuteTool({ projectId: "proj-test-001", mcpRunId: "run-test-001" })

    expect(mcpRunRepo.updateStatus).toHaveBeenCalledWith("run-test-001", "failed", expect.objectContaining({ error: expect.any(String) }))
    // Should still attempt analysis since output > 50 chars
    const { createPgBossJobQueue } = await import("@/lib/infra/job-queue")
    const queue = createPgBossJobQueue()
    expect(queue.publish).toHaveBeenCalledWith("analyze_result", expect.objectContaining({ mcpRunId: "run-test-001" }))
  })

  it("超时 → 标记 failed，不抛异常", async () => {
    vi.mocked(mcpRunRepo.findById).mockResolvedValue(mockMcpRun() as never)
    vi.mocked(projectRepo.findById).mockResolvedValue(mockProject({ lifecycle: "executing" }) as never)
    vi.mocked(mcpRunRepo.findByProjectAndRound).mockResolvedValue([mockMcpRun({ status: "failed" })] as never)
    mockCallTool.mockImplementation(() => new Promise(() => {})) // never resolves

    // The tool timeout is 5 min in production, but we can't wait that long.
    // Instead test that exceptions don't propagate by mocking a rejection
    mockCallTool.mockRejectedValue(new Error("Tool execution timeout after 300000ms"))

    // Should NOT throw — execution worker catches and degrades
    await handleExecuteTool({ projectId: "proj-test-001", mcpRunId: "run-test-001" })

    expect(mcpRunRepo.updateStatus).toHaveBeenCalledWith("run-test-001", "failed", expect.objectContaining({ error: expect.stringContaining("timeout") }))
  })

  it("项目已停止：取消执行", async () => {
    vi.mocked(mcpRunRepo.findById).mockResolvedValue(mockMcpRun() as never)
    vi.mocked(projectRepo.findById).mockResolvedValue(mockProject({ lifecycle: "stopped" }) as never)

    await handleExecuteTool({ projectId: "proj-test-001", mcpRunId: "run-test-001" })

    expect(mockCallTool).not.toHaveBeenCalled()
    expect(mcpRunRepo.updateStatus).toHaveBeenCalledWith("run-test-001", "cancelled")
  })

  it("McpRun 不存在：静默返回", async () => {
    vi.mocked(mcpRunRepo.findById).mockResolvedValue(null as never)

    await handleExecuteTool({ projectId: "proj-test-001", mcpRunId: "non-existent" })

    expect(mockCallTool).not.toHaveBeenCalled()
  })
})
