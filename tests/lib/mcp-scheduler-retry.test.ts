import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { dispatchStoredMcpRun, getStoredMcpRunById } from "@/lib/mcp-gateway-repository"
import { getStoredSchedulerTaskByRunId } from "@/lib/mcp-scheduler-repository"
import { createStoredProjectFixture, seedWorkflowReadyMcpTools } from "@/tests/helpers/project-fixtures"

let mockedExecutionResult:
  | {
      status: "retryable_failure"
      connectorKey: string
      mode: "local" | "real"
      summaryLines: string[]
      errorMessage: string
      retryAfterMinutes?: number
      run: Awaited<ReturnType<typeof getStoredMcpRunById>>
    }
  | null = null

vi.mock("@/lib/mcp-execution-service", () => ({
  executeStoredMcpRun: vi.fn(async () => mockedExecutionResult),
}))

describe("MCP scheduler retry transitions", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-scheduler-retry-store-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
    mockedExecutionResult = null
  })

  afterEach(() => {
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
    vi.clearAllMocks()
  })

  it("moves retryable failures into retry_scheduled and updates the visible run state", async () => {
    await seedWorkflowReadyMcpTools()
    const fixture = await createStoredProjectFixture()
    const payload = await dispatchStoredMcpRun(fixture.project.id, {
      capability: "DNS / 子域 / 证书情报类",
      requestedAction: "采集证书与子域情报",
      target: fixture.project.seed!,
      riskLevel: "低",
    })

    const queuedRun = await getStoredMcpRunById(payload!.run.id)
    mockedExecutionResult = {
      status: "retryable_failure",
      connectorKey: "real-dns-intelligence",
      mode: "real",
      summaryLines: ["真实 DNS 查询暂时超时。"],
      errorMessage: "temporary dns timeout",
      retryAfterMinutes: 5,
      run: queuedRun,
    }

    const { processStoredSchedulerTask } = await import("@/lib/mcp-scheduler-service")
    const task = await getStoredSchedulerTaskByRunId(payload!.run.id)
    const result = await processStoredSchedulerTask(task!.id)
    const updatedTask = await getStoredSchedulerTaskByRunId(payload!.run.id)
    const updatedRun = await getStoredMcpRunById(payload!.run.id)

    expect(result?.status).toBe("retry_scheduled")
    expect(updatedTask?.status).toBe("retry_scheduled")
    expect(updatedTask?.lastError).toBe("temporary dns timeout")
    expect(updatedRun?.status).toBe("已延后")
    expect(updatedRun?.summaryLines.some((line) => line.includes("重试调度"))).toBe(true)
  })
})
