import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { PATCH as patchProjectSchedulerControl } from "@/app/api/projects/[projectId]/scheduler-control/route"
import { PATCH as patchProjectSchedulerTask } from "@/app/api/projects/[projectId]/scheduler-tasks/[taskId]/route"
import { GET as getProjectOperations } from "@/app/api/projects/[projectId]/operations/route"
import { dispatchStoredMcpRun, updateStoredMcpRun } from "@/lib/mcp-gateway-repository"
import { getStoredSchedulerTaskByRunId, updateStoredSchedulerTask } from "@/lib/mcp-scheduler-repository"
import { createStoredProjectFixture, seedWorkflowReadyMcpTools } from "@/tests/helpers/project-fixtures"

const buildProjectContext = (projectId: string) => ({
  params: Promise.resolve({ projectId }),
})

const buildProjectTaskContext = (projectId: string, taskId: string) => ({
  params: Promise.resolve({ projectId, taskId }),
})

describe("scheduler control api routes", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-scheduler-api-store-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
  })

  afterEach(() => {
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("persists project-level scheduler control updates and exposes them on the operations payload", async () => {
    const fixture = createStoredProjectFixture()
    const response = await patchProjectSchedulerControl(
      new Request(`http://localhost/api/projects/${fixture.project.id}/scheduler-control`, {
        method: "PATCH",
        body: JSON.stringify({
          paused: true,
          note: "测试项目临时暂停调度，等待人工确认运行窗口。",
        }),
        headers: { "content-type": "application/json" },
      }),
      buildProjectContext(fixture.project.id),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.schedulerControl.paused).toBe(true)

    const operationsResponse = await getProjectOperations(
      new Request(`http://localhost/api/projects/${fixture.project.id}/operations`),
      buildProjectContext(fixture.project.id),
    )
    const operationsPayload = await operationsResponse.json()

    expect(operationsResponse.status).toBe(200)
    expect(operationsPayload.schedulerControl.paused).toBe(true)
    expect(Array.isArray(operationsPayload.schedulerTasks)).toBe(true)
  })

  it("starts an idle project only after manual start, supports pause/resume, and refuses restart after stop", async () => {
    seedWorkflowReadyMcpTools()
    const fixture = createStoredProjectFixture({
      targetInput: "http://127.0.0.1:18080/WebGoat",
      description: "手动开始生命周期测试项目。",
    })

    const startResponse = await patchProjectSchedulerControl(
      new Request(`http://localhost/api/projects/${fixture.project.id}/scheduler-control`, {
        method: "PATCH",
        body: JSON.stringify({
          lifecycle: "running",
          note: "研究员确认后手动开始项目。",
        }),
        headers: { "content-type": "application/json" },
      }),
      buildProjectContext(fixture.project.id),
    )
    const startPayload = await startResponse.json()

    expect(startResponse.status).toBe(200)
    expect(startPayload.schedulerControl.lifecycle).toBe("running")
    expect(startPayload.project.status).toBe("运行中")

    const operationsAfterStart = await getProjectOperations(
      new Request(`http://localhost/api/projects/${fixture.project.id}/operations`),
      buildProjectContext(fixture.project.id),
    )
    const startedOperationsPayload = await operationsAfterStart.json()

    expect(startedOperationsPayload.schedulerControl.lifecycle).toBe("running")
    expect(startedOperationsPayload.orchestrator.lastPlan).not.toBeNull()

    const pauseResponse = await patchProjectSchedulerControl(
      new Request(`http://localhost/api/projects/${fixture.project.id}/scheduler-control`, {
        method: "PATCH",
        body: JSON.stringify({
          lifecycle: "paused",
          note: "研究员临时暂停项目。",
        }),
        headers: { "content-type": "application/json" },
      }),
      buildProjectContext(fixture.project.id),
    )
    const pausePayload = await pauseResponse.json()

    expect(pauseResponse.status).toBe(200)
    expect(pausePayload.schedulerControl.lifecycle).toBe("paused")
    expect(pausePayload.project.status).toBe("已暂停")

    const resumeResponse = await patchProjectSchedulerControl(
      new Request(`http://localhost/api/projects/${fixture.project.id}/scheduler-control`, {
        method: "PATCH",
        body: JSON.stringify({
          lifecycle: "running",
          note: "研究员恢复项目执行。",
        }),
        headers: { "content-type": "application/json" },
      }),
      buildProjectContext(fixture.project.id),
    )
    const resumePayload = await resumeResponse.json()

    expect(resumeResponse.status).toBe(200)
    expect(resumePayload.schedulerControl.lifecycle).toBe("running")
    expect(resumePayload.project.status).toBe("运行中")

    const stopResponse = await patchProjectSchedulerControl(
      new Request(`http://localhost/api/projects/${fixture.project.id}/scheduler-control`, {
        method: "PATCH",
        body: JSON.stringify({
          lifecycle: "stopped",
          note: "研究员确认停止项目，不再继续。",
        }),
        headers: { "content-type": "application/json" },
      }),
      buildProjectContext(fixture.project.id),
    )
    const stopPayload = await stopResponse.json()

    expect(stopResponse.status).toBe(200)
    expect(stopPayload.schedulerControl.lifecycle).toBe("stopped")
    expect(stopPayload.project.status).toBe("已停止")

    const restartResponse = await patchProjectSchedulerControl(
      new Request(`http://localhost/api/projects/${fixture.project.id}/scheduler-control`, {
        method: "PATCH",
        body: JSON.stringify({
          lifecycle: "running",
          note: "停止后尝试重新开始。",
        }),
        headers: { "content-type": "application/json" },
      }),
      buildProjectContext(fixture.project.id),
    )
    const restartPayload = await restartResponse.json()

    expect(restartResponse.status).toBe(409)
    expect(restartPayload.error).toContain("stopped")
  })

  it("cancels a queued scheduler task through the project api", async () => {
    seedWorkflowReadyMcpTools()
    const fixture = createStoredProjectFixture()
    const dispatchPayload = dispatchStoredMcpRun(fixture.project.id, {
      capability: "DNS / 子域 / 证书情报类",
      requestedAction: "补采证书与子域情报",
      target: fixture.project.seed,
      riskLevel: "低",
    })
    const task = getStoredSchedulerTaskByRunId(dispatchPayload!.run.id)

    const response = await patchProjectSchedulerTask(
      new Request(`http://localhost/api/projects/${fixture.project.id}/scheduler-tasks/${task!.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "cancel",
          note: "研究员手动取消当前排队任务。",
        }),
        headers: { "content-type": "application/json" },
      }),
      buildProjectTaskContext(fixture.project.id, task!.id),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.task.status).toBe("cancelled")
    expect(payload.run.status).toBe("已取消")
  })

  it("records a stop request for a running scheduler task through the project api", async () => {
    seedWorkflowReadyMcpTools()
    const fixture = createStoredProjectFixture()
    const dispatchPayload = dispatchStoredMcpRun(fixture.project.id, {
      capability: "DNS / 子域 / 证书情报类",
      requestedAction: "补采证书与子域情报",
      target: fixture.project.seed,
      riskLevel: "低",
    })
    const task = getStoredSchedulerTaskByRunId(dispatchPayload!.run.id)

    updateStoredSchedulerTask(task!.id, {
      status: "running",
      summaryLines: [...task!.summaryLines, "当前任务正在执行中。"],
    })

    const response = await patchProjectSchedulerTask(
      new Request(`http://localhost/api/projects/${fixture.project.id}/scheduler-tasks/${task!.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "cancel",
          note: "研究员请求停止当前运行中的任务。",
        }),
        headers: { "content-type": "application/json" },
      }),
      buildProjectTaskContext(fixture.project.id, task!.id),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.task.status).toBe("cancelled")
    expect(payload.run.status).toBe("已取消")
  })

  it("retries a failed scheduler task through the project api", async () => {
    seedWorkflowReadyMcpTools()
    const fixture = createStoredProjectFixture()
    const dispatchPayload = dispatchStoredMcpRun(fixture.project.id, {
      capability: "DNS / 子域 / 证书情报类",
      requestedAction: "补采证书与子域情报",
      target: fixture.project.seed,
      riskLevel: "低",
    })
    const task = getStoredSchedulerTaskByRunId(dispatchPayload!.run.id)

    updateStoredSchedulerTask(task!.id, {
      lastError: "temporary dns timeout",
      status: "failed",
      summaryLines: [...task!.summaryLines, "最近一次执行失败。"],
    })
    updateStoredMcpRun(dispatchPayload!.run.id, {
      status: "已阻塞",
      summaryLines: [...dispatchPayload!.run.summaryLines, "最近一次执行失败。"],
    })

    const response = await patchProjectSchedulerTask(
      new Request(`http://localhost/api/projects/${fixture.project.id}/scheduler-tasks/${task!.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "retry",
          note: "研究员确认后重新排队。",
        }),
        headers: { "content-type": "application/json" },
      }),
      buildProjectTaskContext(fixture.project.id, task!.id),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.task.status).toBe("ready")
    expect(payload.run.status).toBe("执行中")
  })
})
