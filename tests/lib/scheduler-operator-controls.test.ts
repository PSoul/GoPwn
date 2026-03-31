import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { dispatchStoredMcpRun, getStoredMcpRunById, updateStoredMcpRun } from "@/lib/mcp-gateway-repository"
import {
  registerActiveExecution,
  resetActiveExecutionRegistry,
} from "@/lib/mcp-execution-runtime"
import { getStoredSchedulerTaskByRunId, updateStoredSchedulerTask } from "@/lib/mcp-scheduler-repository"
import { drainStoredSchedulerTasks } from "@/lib/mcp-scheduler-service"
import {
  cancelStoredSchedulerTask,
  getStoredProjectSchedulerControl,
  retryStoredSchedulerTask,
  updateStoredProjectSchedulerControl,
} from "@/lib/project-scheduler-control-repository"
import { createStoredProjectFixture, seedWorkflowReadyMcpTools } from "@/tests/helpers/project-fixtures"

describe("scheduler operator controls", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-scheduler-operator-store-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
  })

  afterEach(() => {
    delete process.env.PROTOTYPE_DATA_DIR
    resetActiveExecutionRegistry()
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("pauses a project scheduler and keeps ready work from draining", async () => {
    await seedWorkflowReadyMcpTools()
    const fixture = await createStoredProjectFixture()
    const payload = await dispatchStoredMcpRun(fixture.project.id, {
      capability: "DNS / 子域 / 证书情报类",
      requestedAction: "采集证书与子域情报",
      target: fixture.project.seed!,
      riskLevel: "低",
    })

    expect(payload).not.toBeNull()
    expect((await getStoredProjectSchedulerControl(fixture.project.id))?.paused).toBe(false)

    const updated = await updateStoredProjectSchedulerControl(fixture.project.id, {
      paused: true,
      note: "研究员临时暂停本项目调度，等待人工确认运行窗口。",
    })

    expect((updated as { schedulerControl: { paused: boolean } })?.schedulerControl.paused).toBe(true)

    const drained = await drainStoredSchedulerTasks({ projectId: fixture.project.id })
    const queuedTask = await getStoredSchedulerTaskByRunId(payload!.run.id)
    const queuedRun = await getStoredMcpRunById(payload!.run.id)

    expect(drained.status).toBe("completed")
    expect(queuedTask?.status).toBe("ready")
    expect(queuedRun?.status).toBe("执行中")
  })

  it("cancels a queued scheduler task and marks the linked run as cancelled", async () => {
    await seedWorkflowReadyMcpTools()
    const fixture = await createStoredProjectFixture()
    const payload = await dispatchStoredMcpRun(fixture.project.id, {
      capability: "DNS / 子域 / 证书情报类",
      requestedAction: "采集证书与子域情报",
      target: fixture.project.seed!,
      riskLevel: "低",
    })

    const queuedTask = await getStoredSchedulerTaskByRunId(payload!.run.id)
    const result = await cancelStoredSchedulerTask(fixture.project.id, queuedTask!.id, "研究员手动取消当前排队任务。")

    expect(result?.task.status).toBe("cancelled")
    expect(result!.run!.status).toBe("已取消")
    expect(result?.task.summaryLines.at(-1)).toContain("手动取消")
  })

  it("records a stop request for a running scheduler task and closes the linked run", async () => {
    await seedWorkflowReadyMcpTools()
    const fixture = await createStoredProjectFixture()
    const payload = await dispatchStoredMcpRun(fixture.project.id, {
      capability: "DNS / 子域 / 证书情报类",
      requestedAction: "采集证书与子域情报",
      target: fixture.project.seed!,
      riskLevel: "低",
    })

    const runningTask = await getStoredSchedulerTaskByRunId(payload!.run.id)
    await updateStoredSchedulerTask(runningTask!.id, {
      status: "running",
      summaryLines: [...runningTask!.summaryLines, "当前任务正在执行中。"],
    })
    const controller = new AbortController()
    registerActiveExecution(payload!.run.id, controller)

    const result = await cancelStoredSchedulerTask(fixture.project.id, runningTask!.id, "研究员请求停止当前运行中的任务。")

    expect(result?.task.status).toBe("cancelled")
    expect(result!.run!.status).toBe("已取消")
    expect(result?.task.summaryLines.at(-1)).toContain("停止")
    expect(controller.signal.aborted).toBe(true)
  })

  it("requeues a failed scheduler task for another attempt", async () => {
    await seedWorkflowReadyMcpTools()
    const fixture = await createStoredProjectFixture()
    const payload = await dispatchStoredMcpRun(fixture.project.id, {
      capability: "DNS / 子域 / 证书情报类",
      requestedAction: "采集证书与子域情报",
      target: fixture.project.seed!,
      riskLevel: "低",
    })

    const task = await getStoredSchedulerTaskByRunId(payload!.run.id)
    await updateStoredSchedulerTask(task!.id, {
      lastError: "temporary dns timeout",
      status: "failed",
      summaryLines: [...task!.summaryLines, "最近一次执行失败。"],
    })
    await updateStoredMcpRun(payload!.run.id, {
      status: "已阻塞",
      summaryLines: [...payload!.run.summaryLines, "最近一次执行失败。"],
    })

    const retried = await retryStoredSchedulerTask(fixture.project.id, task!.id, "研究员确认后重新排队。")

    expect(retried?.task.status).toBe("ready")
    expect(retried?.task.lastError).toBeUndefined()
    expect(retried!.run!.status).toBe("执行中")
    expect(retried?.task.summaryLines.at(-1)).toContain("重新排队")
  })
})
