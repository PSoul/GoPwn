import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { listStoredAssets } from "@/lib/asset-repository"
import { executeStoredMcpRun } from "@/lib/mcp-execution-service"
import { dispatchStoredMcpRun, getStoredMcpRunById } from "@/lib/mcp-gateway-repository"
import { getStoredSchedulerTaskByRunId, updateStoredSchedulerTask } from "@/lib/mcp-scheduler-repository"
import { createStoredProjectFixture, seedWorkflowReadyMcpTools } from "@/tests/helpers/project-fixtures"

describe("MCP execution service cancellation guard", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-execution-guard-store-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
  })

  afterEach(() => {
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("does not commit normalized execution results when the scheduler task is already cancelled", async () => {
    seedWorkflowReadyMcpTools()
    const fixture = createStoredProjectFixture()
    const payload = dispatchStoredMcpRun(fixture.project.id, {
      capability: "DNS / 子域 / 证书情报类",
      requestedAction: "补采证书与子域情报",
      target: fixture.project.seed,
      riskLevel: "低",
    })

    const task = getStoredSchedulerTaskByRunId(payload!.run.id)
    updateStoredSchedulerTask(task!.id, {
      status: "cancelled",
      summaryLines: [...task!.summaryLines, "研究员请求停止当前运行中的任务。"],
    })

    const result = await executeStoredMcpRun(payload!.run.id)

    expect(result?.status).toBe("aborted")
    expect(getStoredMcpRunById(payload!.run.id)?.status).toBe("已取消")
    expect(listStoredAssets(fixture.project.id)).toHaveLength(0)
  })
})
