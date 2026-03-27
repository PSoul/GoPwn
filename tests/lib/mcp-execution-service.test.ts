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

  it("does not commit normalized execution results when the lease ownership has moved to a newer worker", async () => {
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
      heartbeatAt: "2026-03-27 16:20",
      leaseExpiresAt: "2026-03-27 16:21",
      leaseStartedAt: "2026-03-27 16:20",
      leaseToken: "lease-new",
      status: "running",
      summaryLines: [...task!.summaryLines, "任务已由新的 durable worker 重新认领。"],
      workerId: "worker-new",
    })

    const result = await executeStoredMcpRun(payload!.run.id, {}, {
      leaseToken: "lease-old",
      workerId: "worker-old",
    })

    expect(result?.status).toBe("ownership_lost")
    expect(getStoredMcpRunById(payload!.run.id)?.status).toBe("执行中")
    expect(listStoredAssets(fixture.project.id)).toHaveLength(0)
  })

  it("falls back to built-in target normalization when a fresh workspace has not registered any tools yet", async () => {
    const fixture = createStoredProjectFixture({
      seed: "http://127.0.0.1:18080/WebGoat",
      targetType: "url",
    })
    const payload = dispatchStoredMcpRun(fixture.project.id, {
      capability: "目标解析类",
      requestedAction: "标准化 WebGoat 种子目标",
      target: fixture.project.seed,
      riskLevel: "低",
    })

    expect(payload?.run.toolName).toBe("seed-normalizer")
    expect(payload?.run.status).toBe("执行中")

    const result = await executeStoredMcpRun(payload!.run.id)

    expect(result?.status).toBe("succeeded")
    expect(getStoredMcpRunById(payload!.run.id)?.status).toBe("已执行")
    expect(getStoredMcpRunById(payload!.run.id)?.toolName).toBe("seed-normalizer")
  })

  it("falls back to the built-in report exporter when no explicit report tool has been registered", async () => {
    const fixture = createStoredProjectFixture({
      seed: "http://127.0.0.1:18080/WebGoat",
      targetType: "url",
    })
    const payload = dispatchStoredMcpRun(fixture.project.id, {
      capability: "报告导出类",
      requestedAction: "导出项目报告",
      target: fixture.project.code,
      riskLevel: "低",
    })

    expect(payload?.run.toolName).toBe("report-exporter")
    expect(payload?.run.status).toBe("执行中")

    const result = await executeStoredMcpRun(payload!.run.id)

    expect(result?.status).toBe("succeeded")
    expect(getStoredMcpRunById(payload!.run.id)?.status).toBe("已执行")
    expect(getStoredMcpRunById(payload!.run.id)?.toolName).toBe("report-exporter")
  })
})
