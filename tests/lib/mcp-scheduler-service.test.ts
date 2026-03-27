import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { updateStoredApprovalDecision } from "@/lib/approval-repository"
import { dispatchStoredMcpRun, getStoredMcpRunById } from "@/lib/mcp-gateway-repository"
import {
  claimStoredSchedulerTask,
  getStoredSchedulerTaskByRunId,
  updateStoredSchedulerTask,
} from "@/lib/mcp-scheduler-repository"
import {
  drainStoredSchedulerTasks,
  syncStoredSchedulerTaskAfterApprovalDecision,
} from "@/lib/mcp-scheduler-service"
import { createStoredProjectFixture, seedWorkflowReadyMcpTools } from "@/tests/helpers/project-fixtures"

describe("MCP scheduler service", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-scheduler-store-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
  })

  afterEach(() => {
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("creates ready tasks for auto-runnable work and completes them through the scheduler", async () => {
    seedWorkflowReadyMcpTools()
    const fixture = createStoredProjectFixture()
    const payload = dispatchStoredMcpRun(fixture.project.id, {
      capability: "DNS / 子域 / 证书情报类",
      requestedAction: "补采证书与子域情报",
      target: fixture.project.seed,
      riskLevel: "低",
    })

    expect(payload).not.toBeNull()
    expect(payload?.run.status).toBe("执行中")

    const queuedTask = getStoredSchedulerTaskByRunId(payload!.run.id)
    expect(queuedTask?.status).toBe("ready")

    const drained = await drainStoredSchedulerTasks({ runId: payload!.run.id })
    const completedTask = getStoredSchedulerTaskByRunId(payload!.run.id)
    const completedRun = getStoredMcpRunById(payload!.run.id)

    expect(drained.status).toBe("completed")
    expect(completedTask?.status).toBe("completed")
    expect(completedRun?.status).toBe("已执行")
    expect(completedRun?.connectorMode).toBe("local")
    expect(completedTask?.summaryLines.some((line) => line.includes("执行 worker"))).toBe(true)
    expect(completedTask?.workerId).toBeUndefined()
    expect(completedTask?.leaseExpiresAt).toBeUndefined()
  })

  it("moves approval-gated work into delayed state when the operator postpones it", () => {
    seedWorkflowReadyMcpTools()
    const fixture = createStoredProjectFixture()
    const payload = dispatchStoredMcpRun(fixture.project.id, {
      capability: "受控验证类",
      requestedAction: "匿名鉴权绕过受控验证",
      target: "https://localhost/login",
      riskLevel: "高",
    })

    expect(payload?.approval?.status).toBe("待处理")
    expect(getStoredSchedulerTaskByRunId(payload!.run.id)?.status).toBe("waiting_approval")

    const approval = updateStoredApprovalDecision(payload!.approval!.id, { decision: "已延后" })
    const updatedTask = approval ? syncStoredSchedulerTaskAfterApprovalDecision(approval) : null

    expect(updatedTask?.status).toBe("delayed")
    expect(getStoredMcpRunById(payload!.run.id)?.status).toBe("已延后")
  })

  it("resumes approved work back into the scheduler and completes execution", async () => {
    seedWorkflowReadyMcpTools()
    const fixture = createStoredProjectFixture()
    const payload = dispatchStoredMcpRun(fixture.project.id, {
      capability: "受控验证类",
      requestedAction: "匿名鉴权绕过受控验证",
      target: "https://localhost/login",
      riskLevel: "高",
    })

    expect(payload?.approval?.status).toBe("待处理")

    const approval = updateStoredApprovalDecision(payload!.approval!.id, { decision: "已批准" })
    const resumedTask = approval ? syncStoredSchedulerTaskAfterApprovalDecision(approval) : null

    expect(resumedTask?.status).toBe("ready")

    const drained = await drainStoredSchedulerTasks({ runId: payload!.run.id })
    const completedTask = getStoredSchedulerTaskByRunId(payload!.run.id)
    const completedRun = getStoredMcpRunById(payload!.run.id)

    expect(drained.status).toBe("completed")
    expect(completedTask?.status).toBe("completed")
    expect(completedRun?.status).toBe("已执行")
    expect(completedRun?.summaryLines.at(-1)).toContain("审批已批准")
  })

  it("recovers expired running tasks before draining the queue again", async () => {
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
      availableAt: "2020-01-01 00:00",
    })

    claimStoredSchedulerTask(task!.id, {
      workerId: "worker-orphan",
      now: "2026-03-27 00:00",
      leaseDurationMs: 1_000,
    })

    const drained = await drainStoredSchedulerTasks({ runId: payload!.run.id })
    const recoveredTask = getStoredSchedulerTaskByRunId(payload!.run.id)
    const recoveredRun = getStoredMcpRunById(payload!.run.id)

    expect(drained.status).toBe("completed")
    expect(recoveredTask?.status).toBe("completed")
    expect(recoveredTask?.recoveryCount).toBe(1)
    expect(recoveredTask?.summaryLines.some((line) => line.includes("租约已过期"))).toBe(true)
    expect(recoveredRun?.status).toBe("已执行")
  })
})
