import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { dispatchStoredMcpRun } from "@/lib/mcp-gateway-repository"
import {
  claimStoredSchedulerTask,
  getStoredSchedulerTaskByRunId,
  heartbeatStoredSchedulerTask,
  recoverExpiredStoredSchedulerTasks,
  updateStoredSchedulerTask,
} from "@/lib/mcp-scheduler-repository"
import { createStoredProjectFixture, seedWorkflowReadyMcpTools } from "@/tests/helpers/project-fixtures"

describe("MCP scheduler repository durable leases", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-scheduler-lease-store-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
  })

  afterEach(() => {
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("claims a ready task with worker lease metadata", async () => {
    await seedWorkflowReadyMcpTools()
    const fixture = await createStoredProjectFixture()
    const payload = await dispatchStoredMcpRun(fixture.project.id, {
      capability: "DNS / 子域 / 证书情报类",
      requestedAction: "补采证书与子域情报",
      target: fixture.project.seed!,
      riskLevel: "低",
    })
    const task = await getStoredSchedulerTaskByRunId(payload!.run.id)
    await updateStoredSchedulerTask(task!.id, {
      availableAt: "2020-01-01 00:00",
    })

    const claimedTask = await claimStoredSchedulerTask(task!.id, {
      workerId: "worker-alpha",
      leaseToken: "lease-alpha",
      now: "2026-03-27 16:00",
      leaseDurationMs: 30_000,
    })

    expect(claimedTask?.status).toBe("running")
    expect(claimedTask?.attempts).toBe(1)
    expect(claimedTask?.workerId).toBe("worker-alpha")
    expect(claimedTask?.leaseToken).toBe("lease-alpha")
    expect(claimedTask?.leaseStartedAt).toBe("2026-03-27 16:00")
    expect(claimedTask?.heartbeatAt).toBe("2026-03-27 16:00")
    expect(claimedTask?.leaseExpiresAt).toBe("2026-03-27 16:00")
  })

  it("refreshes the lease only for the owning worker", async () => {
    await seedWorkflowReadyMcpTools()
    const fixture = await createStoredProjectFixture()
    const payload = await dispatchStoredMcpRun(fixture.project.id, {
      capability: "DNS / 子域 / 证书情报类",
      requestedAction: "补采证书与子域情报",
      target: fixture.project.seed!,
      riskLevel: "低",
    })
    const task = await getStoredSchedulerTaskByRunId(payload!.run.id)
    await updateStoredSchedulerTask(task!.id, {
      availableAt: "2020-01-01 00:00",
    })

    await claimStoredSchedulerTask(task!.id, {
      workerId: "worker-alpha",
      leaseToken: "lease-alpha",
      now: "2026-03-27 16:05",
      leaseDurationMs: 30_000,
    })

    const foreignHeartbeat = await heartbeatStoredSchedulerTask(task!.id, {
      workerId: "worker-alpha",
      leaseToken: "lease-beta",
      now: "2026-03-27 16:06",
      leaseDurationMs: 30_000,
    })
    const refreshedTask = await heartbeatStoredSchedulerTask(task!.id, {
      workerId: "worker-alpha",
      leaseToken: "lease-alpha",
      now: "2026-03-27 16:07",
      leaseDurationMs: 30_000,
    })

    expect(foreignHeartbeat).toBeNull()
    expect(refreshedTask?.heartbeatAt).toBe("2026-03-27 16:07")
    expect(refreshedTask?.leaseExpiresAt).toBe("2026-03-27 16:07")
  })

  it("recovers expired running tasks back into the ready queue", async () => {
    await seedWorkflowReadyMcpTools()
    const fixture = await createStoredProjectFixture()
    const payload = await dispatchStoredMcpRun(fixture.project.id, {
      capability: "DNS / 子域 / 证书情报类",
      requestedAction: "补采证书与子域情报",
      target: fixture.project.seed!,
      riskLevel: "低",
    })
    const task = await getStoredSchedulerTaskByRunId(payload!.run.id)
    await updateStoredSchedulerTask(task!.id, {
      availableAt: "2020-01-01 00:00",
    })

    await claimStoredSchedulerTask(task!.id, {
      workerId: "worker-alpha",
      leaseToken: "lease-alpha",
      now: "2026-03-27 16:10",
      leaseDurationMs: 1_000,
    })

    const recoveredTasks = await recoverExpiredStoredSchedulerTasks({
      now: "2026-03-27 16:12",
      projectId: fixture.project.id,
    })
    const recoveredTask = await getStoredSchedulerTaskByRunId(payload!.run.id)

    expect(recoveredTasks).toHaveLength(1)
    expect(recoveredTask?.status).toBe("ready")
    expect(recoveredTask?.workerId).toBeUndefined()
    expect(recoveredTask?.lastRecoveredAt).toBe("2026-03-27 16:12")
    expect(recoveredTask?.recoveryCount).toBe(1)
    expect(recoveredTask?.summaryLines.some((line) => line.includes("租约已过期"))).toBe(true)
  })
})
