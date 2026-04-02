import { prisma } from "@/lib/prisma"
import {
  toSchedulerTaskRecord,
  fromSchedulerTaskRecord,
  toDbTimestamp,
} from "@/lib/prisma-transforms"
import { formatTimestamp } from "@/lib/prototype-record-utils"
import type {
  McpRunRecord,
  McpSchedulerTaskRecord,
  McpSchedulerTaskStatus,
} from "@/lib/prototype-types"

function buildSchedulerTaskId() {
  return `task-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
}

function parseRetryCount(retryRule: string | undefined) {
  const matched = retryRule?.match(/(\d+)/)

  if (!matched) {
    return 0
  }

  return Number(matched[1]) || 0
}

function addMilliseconds(timestamp: string, durationMs: number) {
  const base = new Date(timestamp.replace(" ", "T"))
  base.setTime(base.getTime() + durationMs)

  return formatTimestamp(base)
}

function buildLeaseToken() {
  return `lease-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

export async function listStoredSchedulerTasks(projectId?: string) {
  const rows = await prisma.schedulerTask.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { queuedAt: "desc" },
  })
  return rows.map(toSchedulerTaskRecord)
}

export async function getStoredSchedulerTaskById(taskId: string) {
  const row = await prisma.schedulerTask.findUnique({ where: { id: taskId } })
  return row ? toSchedulerTaskRecord(row) : null
}

export async function getStoredSchedulerTaskByRunId(runId: string) {
  const row = await prisma.schedulerTask.findFirst({ where: { runId } })
  return row ? toSchedulerTaskRecord(row) : null
}

export async function createStoredSchedulerTask(
  run: McpRunRecord,
  input: {
    connectorMode: "local" | "real"
    status: McpSchedulerTaskStatus
    maxAttempts?: number
    availableAt?: string
    summaryLines?: string[]
  },
) {
  const timestamp = formatTimestamp()
  const task: McpSchedulerTaskRecord = {
    id: buildSchedulerTaskId(),
    runId: run.id,
    projectId: run.projectId,
    projectName: run.projectName,
    capability: run.capability,
    target: run.target,
    toolName: run.toolName,
    connectorMode: input.connectorMode,
    status: input.status,
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 0,
    queuedAt: timestamp,
    availableAt: input.availableAt ?? timestamp,
    updatedAt: timestamp,
    linkedApprovalId: run.linkedApprovalId,
    recoveryCount: 0,
    summaryLines: input.summaryLines ?? [...run.summaryLines],
  }

  await prisma.schedulerTask.create({ data: fromSchedulerTaskRecord(task) })
  return task
}

export async function createStoredSchedulerTaskFromRun(
  run: McpRunRecord,
  retryRule?: string,
  connectorMode: "local" | "real" = run.connectorMode ?? "local",
) {
  const status: McpSchedulerTaskStatus =
    run.status === "待审批"
      ? "waiting_approval"
      : run.status === "已延后"
        ? "delayed"
        : run.status === "已执行"
          ? "completed"
          : run.status === "已拒绝" || run.status === "已取消"
            ? "cancelled"
            : run.status === "已阻塞"
              ? "failed"
              : "ready"

  return createStoredSchedulerTask(run, {
    connectorMode,
    status,
    maxAttempts: parseRetryCount(retryRule),
  })
}

export async function updateStoredSchedulerTask(
  taskId: string,
  patch: Partial<
    Pick<
      McpSchedulerTaskRecord,
      | "availableAt"
      | "attempts"
      | "connectorMode"
      | "heartbeatAt"
      | "lastError"
      | "lastRecoveredAt"
      | "leaseExpiresAt"
      | "leaseStartedAt"
      | "leaseToken"
      | "recoveryCount"
      | "status"
      | "summaryLines"
      | "updatedAt"
      | "workerId"
    >
  >,
) {
  const existing = await prisma.schedulerTask.findUnique({ where: { id: taskId } })
  if (!existing) return null
  const data: Record<string, unknown> = {}
  if (patch.status !== undefined) data.status = patch.status
  if (patch.attempts !== undefined) data.attempts = patch.attempts
  if (patch.connectorMode !== undefined) data.connectorMode = patch.connectorMode
  if (patch.summaryLines !== undefined) data.summaryLines = patch.summaryLines
  if (patch.lastError !== undefined) data.lastError = patch.lastError ?? null
  if (patch.recoveryCount !== undefined) data.recoveryCount = patch.recoveryCount ?? null
  if (patch.workerId !== undefined) data.workerId = patch.workerId ?? null
  if (patch.leaseToken !== undefined) data.leaseToken = patch.leaseToken ?? null
  if (patch.leaseStartedAt !== undefined) data.leaseStartedAt = patch.leaseStartedAt ?? null
  if (patch.leaseExpiresAt !== undefined) data.leaseExpiresAt = patch.leaseExpiresAt ?? null
  if (patch.heartbeatAt !== undefined) data.heartbeatAt = patch.heartbeatAt ?? null
  if (patch.lastRecoveredAt !== undefined) data.lastRecoveredAt = patch.lastRecoveredAt ?? null
  if (patch.availableAt !== undefined) data.availableAt = toDbTimestamp(patch.availableAt)
  // Use updateMany to avoid throwing when the task was concurrently removed
  const result = await prisma.schedulerTask.updateMany({ where: { id: taskId }, data })
  if (result.count === 0) return null
  const refreshed = await prisma.schedulerTask.findUnique({ where: { id: taskId } })
  return refreshed ? toSchedulerTaskRecord(refreshed) : null
}

export async function claimStoredSchedulerTask(
  taskId: string,
  input: {
    workerId: string
    leaseToken?: string
    now?: string
    leaseDurationMs?: number
  },
) {
  const now = input.now ?? formatTimestamp()
  const nowDate = toDbTimestamp(now)
  const claimableStatuses = ["ready", "retry_scheduled", "delayed"]

  // Conditional update for atomicity — only succeeds if status + availableAt match
  const result = await prisma.schedulerTask.updateMany({
    where: {
      id: taskId,
      status: { in: claimableStatuses },
      availableAt: { lte: nowDate },
    },
    data: {
      status: "running",
      workerId: input.workerId,
      leaseToken: input.leaseToken ?? buildLeaseToken(),
      leaseStartedAt: now,
      leaseExpiresAt: addMilliseconds(now, input.leaseDurationMs ?? 30_000),
      heartbeatAt: now,
      lastError: null,
    },
  })
  if (result.count === 0) return null

  // Increment attempts + append summary separately (need current values)
  const row = await prisma.schedulerTask.findUnique({ where: { id: taskId } })
  if (!row) return null
  const currentSummary = row.summaryLines ?? []
  const updated = await prisma.schedulerTask.update({
    where: { id: taskId },
    data: {
      attempts: row.attempts + 1,
      summaryLines: [...currentSummary, `执行 worker ${input.workerId} 已认领任务并建立执行租约。`],
    },
  })
  return toSchedulerTaskRecord(updated)
}

export async function heartbeatStoredSchedulerTask(
  taskId: string,
  input: {
    workerId: string
    leaseToken: string
    now?: string
    leaseDurationMs?: number
  },
) {
  const now = input.now ?? formatTimestamp()
  // Conditional update verifying workerId + leaseToken
  const result = await prisma.schedulerTask.updateMany({
    where: {
      id: taskId,
      status: "running",
      workerId: input.workerId,
      leaseToken: input.leaseToken,
    },
    data: {
      heartbeatAt: now,
      leaseExpiresAt: addMilliseconds(now, input.leaseDurationMs ?? 30_000),
    },
  })
  if (result.count === 0) return null
  const row = await prisma.schedulerTask.findUnique({ where: { id: taskId } })
  return row ? toSchedulerTaskRecord(row) : null
}

export async function clearStoredSchedulerTaskLease(taskId: string) {
  const task = await getStoredSchedulerTaskById(taskId)

  if (!task) {
    return null
  }

  return updateStoredSchedulerTask(task.id, {
    heartbeatAt: undefined,
    leaseExpiresAt: undefined,
    leaseStartedAt: undefined,
    leaseToken: undefined,
    workerId: undefined,
  })
}

export async function recoverExpiredStoredSchedulerTasks(
  input: {
    now?: string
    projectId?: string
    runId?: string
  } = {},
) {
  const now = input.now ?? formatTimestamp()
  const nowDate = toDbTimestamp(now)
  const where: Record<string, unknown> = { status: "running" }
  if (input.projectId) where.projectId = input.projectId
  if (input.runId) where.runId = input.runId
  // Find expired: running tasks with leaseExpiresAt < now or leaseExpiresAt is null
  where.OR = [
    { leaseExpiresAt: { lt: now } },
    { leaseExpiresAt: null },
  ]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expiredRows = await prisma.schedulerTask.findMany({ where: where as any })
  const results: McpSchedulerTaskRecord[] = []
  for (const row of expiredRows) {
    const task = toSchedulerTaskRecord(row)
    // Check if the linked MCP run already completed — if so, mark task as completed
    // instead of resetting to "ready" (which would re-execute an already-finished run).
    const linkedRun = task.runId ? await prisma.mcpRun.findUnique({ where: { id: task.runId } }) : null
    const runAlreadyCompleted = linkedRun && ["已执行", "已完成"].includes(linkedRun.status as string)
    const nextStatus = runAlreadyCompleted ? "completed" : "ready"
    const summaryNote = runAlreadyCompleted
      ? "MCP run 已完成但任务状态未同步，已自动标记为完成。"
      : task.leaseExpiresAt
        ? "执行 worker 租约已过期，任务已恢复回待执行队列。"
        : "任务缺少可用执行租约元数据，已恢复回待执行队列。"
    const updated = await prisma.schedulerTask.update({
      where: { id: task.id },
      data: {
        status: nextStatus,
        availableAt: runAlreadyCompleted ? undefined : nowDate,
        heartbeatAt: null,
        lastRecoveredAt: now,
        leaseExpiresAt: null,
        leaseStartedAt: null,
        leaseToken: null,
        recoveryCount: (row.recoveryCount ?? 0) + 1,
        summaryLines: [...task.summaryLines, summaryNote],
        workerId: null,
      },
    })
    results.push(toSchedulerTaskRecord(updated))
  }
  return results
}

export async function listReadyStoredSchedulerTasks(
  input: {
    projectId?: string
    runId?: string
    now?: string
  } = {},
) {
  const now = input.now ?? formatTimestamp()
  const nowDate = toDbTimestamp(now)
  const readyStatuses = ["ready", "retry_scheduled", "delayed"]
  const where: Record<string, unknown> = {
    status: { in: readyStatuses },
    availableAt: { lte: nowDate },
  }
  if (input.projectId) where.projectId = input.projectId
  if (input.runId) where.runId = input.runId
  const rows = await prisma.schedulerTask.findMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: where as any,
    orderBy: { availableAt: "asc" },
  })
  return rows.map(toSchedulerTaskRecord)
}
