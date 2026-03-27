import { getStoredApprovalById } from "@/lib/approval-repository"
import { resolveMcpConnector } from "@/lib/mcp-connectors/registry"
import { executeStoredMcpRun } from "@/lib/mcp-execution-service"
import { getStoredMcpRunById, updateStoredMcpRun } from "@/lib/mcp-gateway-repository"
import { getStoredMcpToolById } from "@/lib/mcp-repository"
import { isStoredProjectSchedulerPaused } from "@/lib/project-scheduler-control-repository"
import {
  createStoredSchedulerTask,
  getStoredSchedulerTaskById,
  getStoredSchedulerTaskByRunId,
  listReadyStoredSchedulerTasks,
  listStoredSchedulerTasks,
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

function addMinutes(timestamp: string, minutes: number) {
  const base = new Date(timestamp.replace(" ", "T"))
  base.setMinutes(base.getMinutes() + minutes)

  return formatTimestamp(base)
}

function appendRunSummary(run: McpRunRecord, lines: string[]) {
  return Array.from(new Set([...run.summaryLines, ...lines]))
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
      lastError: "关联 MCP run 不存在。",
      status: "failed",
      summaryLines: [...task.summaryLines, "关联 MCP run 丢失，任务已标记失败。"],
    })
  }

  const runningTask = updateStoredSchedulerTask(task.id, {
    attempts: task.attempts + 1,
    status: "running",
    summaryLines: appendRunSummary(run, [`任务已进入执行态，第 ${task.attempts + 1} 次尝试。`]),
  })

  updateStoredMcpRun(run.id, {
    connectorMode: runningTask?.connectorMode ?? task.connectorMode,
    status: "执行中",
    summaryLines: appendRunSummary(run, [`${task.toolName} 已由调度器认领执行。`]),
  })

  const result = await executeStoredMcpRun(run.id, priorOutputs)

  if (!result) {
    const failedTask = updateStoredSchedulerTask(task.id, {
      lastError: "执行器未返回结果。",
      status: "failed",
      summaryLines: [...task.summaryLines, "执行器未返回结果，任务已标记失败。"],
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
    const cancelledTask = getStoredSchedulerTaskByRunId(run.id)
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
      connectorMode: result.mode,
      lastError: undefined,
      status: "completed",
      summaryLines: appendRunSummary(result.run, result.run.summaryLines),
    })

    return {
      status: "succeeded" as const,
      run: result.run,
      task: completedTask ?? task,
      outputs: result.outputs,
    }
  }

  const currentAttempt = (runningTask?.attempts ?? task.attempts + 1)
  const canRetry = result.status === "retryable_failure" && currentAttempt <= task.maxAttempts

  if (canRetry) {
    const retryAt = addMinutes(formatTimestamp(), result.retryAfterMinutes ?? 10)
    const delayedTask = updateStoredSchedulerTask(task.id, {
      availableAt: retryAt,
      connectorMode: result.mode,
      lastError: result.errorMessage,
      status: "retry_scheduled",
      summaryLines: [...task.summaryLines, ...result.summaryLines, `已安排重试时间：${retryAt}。`],
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
    connectorMode: result.mode,
    lastError: result.errorMessage,
    status: "failed",
    summaryLines: [...task.summaryLines, ...result.summaryLines, `最终失败：${result.errorMessage}`],
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
  let outputs = input.priorOutputs ?? {}
  const runs: McpRunRecord[] = []
  const tasks: McpSchedulerTaskRecord[] = []
  const readyTasks = listReadyStoredSchedulerTasks({
    now: formatTimestamp(),
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
