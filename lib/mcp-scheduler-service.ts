import { setInterval as setIntervalPromise } from "node:timers/promises"

import { getStoredApprovalById } from "@/lib/approval-repository"
import { resolveMcpConnector } from "@/lib/mcp-connectors/registry"
import { executeStoredMcpRun } from "@/lib/mcp-execution-service"
import { getStoredMcpRunById, updateStoredMcpRun } from "@/lib/mcp-gateway-repository"
import { getStoredMcpToolById } from "@/lib/mcp-repository"
import { isStoredProjectSchedulerPaused } from "@/lib/project-scheduler-control-repository"
import {
  claimStoredSchedulerTask,
  createStoredSchedulerTask,
  getStoredSchedulerTaskById,
  getStoredSchedulerTaskByRunId,
  heartbeatStoredSchedulerTask,
  listReadyStoredSchedulerTasks,
  listStoredSchedulerTasks,
  recoverExpiredStoredSchedulerTasks,
  updateStoredSchedulerTask,
} from "@/lib/mcp-scheduler-repository"
import { formatTimestamp } from "@/lib/prototype-record-utils"
import { getStoredProjectById } from "@/lib/project-repository"
import type {
  ApprovalRecord,
  McpRunRecord,
  McpSchedulerTaskRecord,
  McpWorkflowSmokePayload,
  ProjectRecord,
} from "@/lib/prototype-types"

const TASK_LEASE_DURATION_MS = 30_000
const TASK_HEARTBEAT_INTERVAL_MS = 5_000

type SchedulerTaskOwnership = {
  leaseToken: string
  workerId: string
}

function addMinutes(timestamp: string, minutes: number) {
  const base = new Date(timestamp.replace(" ", "T"))
  base.setMinutes(base.getMinutes() + minutes)

  return formatTimestamp(base)
}

function appendRunSummary(run: McpRunRecord, lines: string[]) {
  return Array.from(new Set([...run.summaryLines, ...lines]))
}

function buildSchedulerWorkerId() {
  return `worker-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError"
}

function buildLeaseClearingPatch() {
  return {
    heartbeatAt: undefined,
    leaseExpiresAt: undefined,
    leaseStartedAt: undefined,
    leaseToken: undefined,
    workerId: undefined,
  } as const
}

function taskMatchesOwnership(task: McpSchedulerTaskRecord | null, ownership: SchedulerTaskOwnership) {
  return Boolean(task && task.workerId === ownership.workerId && task.leaseToken === ownership.leaseToken)
}

async function withTaskHeartbeat<T>(
  taskId: string,
  ownership: SchedulerTaskOwnership,
  work: () => Promise<T>,
) {
  const controller = new AbortController()
  const heartbeatLoop = (async () => {
    try {
      for await (const heartbeatTick of setIntervalPromise(TASK_HEARTBEAT_INTERVAL_MS, undefined, {
        ref: false,
        signal: controller.signal,
      })) {
        void heartbeatTick
        heartbeatStoredSchedulerTask(taskId, {
          leaseDurationMs: TASK_LEASE_DURATION_MS,
          leaseToken: ownership.leaseToken,
          workerId: ownership.workerId,
        })
      }
    } catch (error) {
      if (!isAbortError(error)) {
        throw error
      }
    }
  })()

  try {
    return await work()
  } finally {
    controller.abort()
    await heartbeatLoop
  }
}

function resolveProjectAndTool(run: McpRunRecord) {
  const project = getStoredProjectById(run.projectId)
  const tool = run.toolId ? getStoredMcpToolById(run.toolId) : null

  if (!project) {
    return null
  }

  return { project, tool }
}

export function determineRunConnectorMode(run: McpRunRecord, project?: ProjectRecord) {
  const resolvedProject = project ?? getStoredProjectById(run.projectId)

  if (!resolvedProject) {
    return "local"
  }

  const tool = run.toolId ? getStoredMcpToolById(run.toolId) : null
  const approval = run.linkedApprovalId ? getStoredApprovalById(run.linkedApprovalId) : null
  const connector = resolveMcpConnector({
    approval,
    priorOutputs: {},
    project: resolvedProject,
    run,
    tool,
  })

  return connector?.mode ?? "local"
}

export function ensureStoredSchedulerTaskForRun(run: McpRunRecord) {
  const existingTask = getStoredSchedulerTaskByRunId(run.id)

  if (existingTask) {
    return existingTask
  }

  const resolved = resolveProjectAndTool(run)
  const maxAttempts = (() => {
    const matched = resolved?.tool?.retry.match(/(\d+)/)
    return matched ? Number(matched[1]) || 0 : 0
  })()
  const connectorMode = determineRunConnectorMode(run, resolved?.project)
  const initialStatus =
    run.status === "待审批"
      ? "waiting_approval"
      : run.status === "已延后"
        ? "delayed"
        : run.status === "已取消" || run.status === "已拒绝"
          ? "cancelled"
          : run.status === "已阻塞"
          ? "failed"
          : run.status === "已执行"
            ? "completed"
            : "ready"

  return createStoredSchedulerTask(run, {
    connectorMode,
    maxAttempts,
    status: initialStatus,
  })
}

export async function processStoredSchedulerTask(
  taskId: string,
  priorOutputs: McpWorkflowSmokePayload["outputs"] = {},
) {
  const task = getStoredSchedulerTaskById(taskId)

  if (!task || !["ready", "retry_scheduled", "delayed"].includes(task.status)) {
    return null
  }

  const run = getStoredMcpRunById(task.runId)

  if (!run) {
    return updateStoredSchedulerTask(task.id, {
      ...buildLeaseClearingPatch(),
      lastError: "关联 MCP run 不存在。",
      status: "failed",
      summaryLines: [...task.summaryLines, "关联 MCP run 丢失，任务已标记失败。"],
    })
  }

  const claimedTask = claimStoredSchedulerTask(task.id, {
    leaseDurationMs: TASK_LEASE_DURATION_MS,
    workerId: buildSchedulerWorkerId(),
  })
  const ownership =
    claimedTask?.workerId && claimedTask.leaseToken
      ? {
          leaseToken: claimedTask.leaseToken,
          workerId: claimedTask.workerId,
        }
      : null

  if (!claimedTask || !ownership) {
    return null
  }

  updateStoredMcpRun(run.id, {
    connectorMode: claimedTask.connectorMode,
    status: "执行中",
    summaryLines: appendRunSummary(run, [
      `${task.toolName} 已由调度器认领执行。`,
      `执行 worker ${ownership.workerId} 已建立运行租约。`,
    ]),
  })

  const result = await withTaskHeartbeat(task.id, ownership, () =>
    executeStoredMcpRun(run.id, priorOutputs, ownership),
  )

  if (!result) {
    const failedTask = updateStoredSchedulerTask(task.id, {
      ...buildLeaseClearingPatch(),
      lastError: "执行器未返回结果。",
      status: "failed",
      summaryLines: [...claimedTask.summaryLines, "执行器未返回结果，任务已标记失败。"],
    })

    const failedRun = updateStoredMcpRun(run.id, {
      status: "已阻塞",
      summaryLines: appendRunSummary(run, ["执行器未返回结果，MCP run 已阻塞。"]),
    })

    return {
      status: "failed" as const,
      run: failedRun ?? run,
      task: failedTask ?? task,
      outputs: priorOutputs,
    }
  }

  if (result.status === "aborted") {
    const currentTask = getStoredSchedulerTaskByRunId(run.id)
    const cancelledTask = taskMatchesOwnership(currentTask, ownership)
      ? updateStoredSchedulerTask(currentTask!.id, buildLeaseClearingPatch())
      : currentTask
    const cancelledRun = getStoredMcpRunById(run.id)

    return {
      status: "cancelled" as const,
      run: cancelledRun ?? run,
      task: cancelledTask ?? task,
      outputs: priorOutputs,
    }
  }

  if (result.status === "succeeded") {
    const completedTask = updateStoredSchedulerTask(task.id, {
      ...buildLeaseClearingPatch(),
      connectorMode: result.mode,
      lastError: undefined,
      status: "completed",
      summaryLines: Array.from(new Set([...claimedTask.summaryLines, ...result.run.summaryLines])),
    })

    return {
      status: "succeeded" as const,
      run: result.run,
      task: completedTask ?? task,
      outputs: result.outputs,
    }
  }

  const currentAttempt = claimedTask.attempts
  const canRetry = result.status === "retryable_failure" && currentAttempt <= task.maxAttempts

  if (canRetry) {
    const retryAt = addMinutes(formatTimestamp(), result.retryAfterMinutes ?? 10)
    const delayedTask = updateStoredSchedulerTask(task.id, {
      ...buildLeaseClearingPatch(),
      availableAt: retryAt,
      connectorMode: result.mode,
      lastError: result.errorMessage,
      status: "retry_scheduled",
      summaryLines: [...claimedTask.summaryLines, ...result.summaryLines, `已安排重试时间：${retryAt}。`],
    })
    const delayedRun = updateStoredMcpRun(run.id, {
      connectorMode: result.mode,
      status: "已延后",
      summaryLines: appendRunSummary(run, [...result.summaryLines, `任务已转入重试调度，预计 ${retryAt} 再次执行。`]),
    })

    return {
      status: "retry_scheduled" as const,
      run: delayedRun ?? run,
      task: delayedTask ?? task,
      outputs: priorOutputs,
    }
  }

  const failedTask = updateStoredSchedulerTask(task.id, {
    ...buildLeaseClearingPatch(),
    connectorMode: result.mode,
    lastError: result.errorMessage,
    status: "failed",
    summaryLines: [...claimedTask.summaryLines, ...result.summaryLines, `最终失败：${result.errorMessage}`],
  })
  const failedRun = updateStoredMcpRun(run.id, {
    connectorMode: result.mode,
    status: "已阻塞",
    summaryLines: appendRunSummary(run, [...result.summaryLines, `执行失败：${result.errorMessage}`]),
  })

  return {
    status: "failed" as const,
    run: failedRun ?? run,
    task: failedTask ?? task,
    outputs: priorOutputs,
  }
}

export async function drainStoredSchedulerTasks(input: {
  projectId?: string
  runId?: string
  priorOutputs?: McpWorkflowSmokePayload["outputs"]
} = {}) {
  const now = formatTimestamp()
  let outputs = input.priorOutputs ?? {}
  const runs: McpRunRecord[] = []
  const tasks: McpSchedulerTaskRecord[] = []
  recoverExpiredStoredSchedulerTasks({
    now,
    projectId: input.projectId,
    runId: input.runId,
  })
  const readyTasks = listReadyStoredSchedulerTasks({
    now,
    projectId: input.projectId,
    runId: input.runId,
  }).filter((task) => !isStoredProjectSchedulerPaused(task.projectId))

  for (const task of readyTasks) {
    const result = await processStoredSchedulerTask(task.id, outputs)

    if (!result) {
      continue
    }

    outputs = result.outputs
    runs.push(result.run)
    tasks.push(result.task)

    if (result.status !== "succeeded") {
      return {
        status: result.status,
        outputs,
        runs,
        tasks,
      }
    }
  }

  return {
    status: "completed" as const,
    outputs,
    runs,
    tasks,
  }
}

export function syncStoredSchedulerTaskAfterApprovalDecision(approval: ApprovalRecord) {
  const schedulerTask = readApprovalLinkedSchedulerTask(approval.id)

  if (!schedulerTask) {
    return null
  }

  if (approval.status === "已批准") {
    return updateStoredSchedulerTask(schedulerTask.id, {
      availableAt: formatTimestamp(),
      lastError: undefined,
      status: "ready",
      summaryLines: [...schedulerTask.summaryLines, "审批已批准，任务已回到可执行队列。"],
    })
  }

  if (approval.status === "已延后") {
    const delayedAt = addMinutes(formatTimestamp(), 30)

    return updateStoredSchedulerTask(schedulerTask.id, {
      availableAt: delayedAt,
      status: "delayed",
      summaryLines: [...schedulerTask.summaryLines, `审批已延后，任务将在 ${delayedAt} 后重新进入候选。`],
    })
  }

  return updateStoredSchedulerTask(schedulerTask.id, {
    status: "cancelled",
    summaryLines: [...schedulerTask.summaryLines, "审批已拒绝，任务已取消。"],
  })
}

function readApprovalLinkedSchedulerTask(approvalId: string) {
  return listStoredSchedulerTasks().find((task) => task.linkedApprovalId === approvalId) ?? null
}
