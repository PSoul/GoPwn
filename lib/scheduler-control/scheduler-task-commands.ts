import { formatTimestamp } from "@/lib/prototype-record-utils"
import { prisma } from "@/lib/prisma"
import {
  fromLogRecord,
  fromProjectDetailRecord,
  fromProjectRecord,
  fromMcpRunRecord,
  toMcpRunRecord,
  toProjectDetailRecord,
  toProjectRecord,
  toSchedulerTaskRecord,
  fromSchedulerTaskRecord,
} from "@/lib/prisma-transforms"
import { abortActiveExecution } from "@/lib/mcp-execution-runtime"
import { createAuditLog, pushProjectActivity } from "./scheduler-control-helpers"
import type {
  McpRunRecord,
  McpSchedulerTaskRecord,
} from "@/lib/prototype-types"

export async function stopStoredProjectSchedulerTasks(
  projectId: string,
  reason = "研究员已停止项目，后续不再继续推进。",
) {
  const timestamp = formatTimestamp()
  const nextRuns: McpRunRecord[] = []
  const nextTasks: McpSchedulerTaskRecord[] = []

  const activeTasks = await prisma.schedulerTask.findMany({
    where: {
      projectId,
      status: { in: ["ready", "retry_scheduled", "delayed", "running"] },
    },
  })

  if (!activeTasks.length) {
    return { runs: nextRuns, tasks: nextTasks }
  }

  const txOps: ReturnType<typeof prisma.schedulerTask.update>[] = []

  for (const taskRow of activeTasks) {
    const task = toSchedulerTaskRecord(taskRow)
    const isRunningTask = task.status === "running"
    const nextTask: McpSchedulerTaskRecord = {
      ...task,
      heartbeatAt: undefined,
      leaseExpiresAt: undefined,
      leaseStartedAt: undefined,
      leaseToken: undefined,
      lastError: undefined,
      status: "cancelled",
      summaryLines: [
        ...task.summaryLines,
        isRunningTask ? `${reason} 当前执行已收到停止请求。` : `${reason} 任务已被终止。`,
      ],
      updatedAt: timestamp,
      workerId: undefined,
    }
    nextTasks.push(nextTask)

    txOps.push(
      prisma.schedulerTask.update({
        where: { id: task.id },
        data: fromSchedulerTaskRecord(nextTask),
      }),
    )

    const runRow = await prisma.mcpRun.findUnique({ where: { id: task.runId } })
    if (runRow) {
      const run = toMcpRunRecord(runRow)
      const nextRun: McpRunRecord = {
        ...run,
        status: "已取消",
        summaryLines: [
          ...run.summaryLines,
          isRunningTask ? `${reason} 平台已请求停止当前执行。` : `${reason} MCP run 已被终止。`,
        ],
        updatedAt: timestamp,
      }
      nextRuns.push(nextRun)
      txOps.push(
        prisma.mcpRun.update({
          where: { id: task.runId },
          data: fromMcpRunRecord(nextRun),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
      )
    }

    if (isRunningTask) {
      abortActiveExecution(task.runId, reason)
    }
  }

  await prisma.$transaction(txOps)

  return { runs: nextRuns, tasks: nextTasks }
}

export async function cancelStoredSchedulerTask(projectId: string, taskId: string, reason = "研究员手动取消当前排队任务。") {
  const projectRow = await prisma.project.findUnique({ where: { id: projectId } })
  const detailRow = await prisma.projectDetail.findUnique({ where: { projectId } })
  const taskRow = await prisma.schedulerTask.findFirst({ where: { id: taskId, projectId } })

  if (!projectRow || !detailRow || !taskRow) return null

  const task = toSchedulerTaskRecord(taskRow)
  if (!["ready", "retry_scheduled", "delayed", "running"].includes(task.status)) return null

  const timestamp = formatTimestamp()
  const project = toProjectRecord(projectRow)
  const detail = toProjectDetailRecord(detailRow)
  const isRunningTask = task.status === "running"

  const nextTask: McpSchedulerTaskRecord = {
    ...task,
    lastError: undefined,
    status: "cancelled",
    summaryLines: [
      ...task.summaryLines,
      isRunningTask ? `${reason} 已记录停止请求，当前结果不会再继续推进。` : `${reason} 任务已手动取消。`,
    ],
    updatedAt: timestamp,
  }

  let nextRun: McpRunRecord | null = null
  const runRow = await prisma.mcpRun.findUnique({ where: { id: task.runId } })
  if (runRow) {
    const run = toMcpRunRecord(runRow)
    nextRun = {
      ...run,
      status: "已取消",
      summaryLines: [
        ...run.summaryLines,
        isRunningTask ? `${reason} 平台已记录停止请求，当前 MCP run 后续不再继续推进。` : `${reason} 调度已终止，不再继续推进该 MCP run。`,
      ],
      updatedAt: timestamp,
    }
  }

  if (isRunningTask) {
    abortActiveExecution(task.runId, reason)
  }

  const nextProject = {
    ...project,
    lastActor: "调度取消",
    lastUpdated: timestamp,
  }
  const nextDetail = pushProjectActivity(
    detail,
    isRunningTask ? "运行任务已记录停止请求" : "调度任务已取消",
    isRunningTask ? `${task.toolName} -> ${task.target} 已停止后续推进并等待当前执行自然收尾。` : `${task.toolName} -> ${task.target} 已从运行队列移除。`,
    "warning",
  )
  const auditLog = createAuditLog(
    `${project.name} ${isRunningTask ? "请求停止运行任务" : "手动取消调度任务"} ${task.id}`,
    "已取消",
    project.name,
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txOps: any[] = [
    prisma.schedulerTask.update({ where: { id: taskId }, data: fromSchedulerTaskRecord(nextTask) }),
    prisma.project.update({ where: { id: projectId }, data: fromProjectRecord(nextProject) }),
    prisma.projectDetail.update({ where: { projectId }, data: fromProjectDetailRecord(nextDetail, projectId) }),
    prisma.auditLog.create({ data: fromLogRecord(auditLog) }),
  ]
  if (nextRun) {
    txOps.push(prisma.mcpRun.update({ where: { id: task.runId }, data: fromMcpRunRecord(nextRun) }))
  }

  await prisma.$transaction(txOps)

  return {
    detail: nextDetail,
    project: nextProject,
    run: nextRun,
    task: nextTask,
  }
}

export async function retryStoredSchedulerTask(projectId: string, taskId: string, reason = "研究员确认后重新排队。") {
  const projectRow = await prisma.project.findUnique({ where: { id: projectId } })
  const detailRow = await prisma.projectDetail.findUnique({ where: { projectId } })
  const taskRow = await prisma.schedulerTask.findFirst({ where: { id: taskId, projectId } })

  if (!projectRow || !detailRow || !taskRow) return null

  const task = toSchedulerTaskRecord(taskRow)
  if (task.status !== "failed") return null

  const timestamp = formatTimestamp()
  const project = toProjectRecord(projectRow)
  const detail = toProjectDetailRecord(detailRow)

  const nextTask: McpSchedulerTaskRecord = {
    ...task,
    availableAt: timestamp,
    lastError: undefined,
    status: "ready",
    summaryLines: [...task.summaryLines, `${reason} 任务已重新进入待执行队列。`],
    updatedAt: timestamp,
  }

  let nextRun: McpRunRecord | null = null
  const runRow = await prisma.mcpRun.findUnique({ where: { id: task.runId } })
  if (runRow) {
    const run = toMcpRunRecord(runRow)
    nextRun = {
      ...run,
      status: "执行中",
      summaryLines: [
        ...run.summaryLines,
        `${reason} MCP run 已重新排队，等待调度器再次执行。`,
      ],
      updatedAt: timestamp,
    }
  }

  const nextProject = {
    ...project,
    lastActor: "调度重试",
    lastUpdated: timestamp,
  }
  const nextDetail = pushProjectActivity(
    detail,
    "失败任务已重新排队",
    `${task.toolName} -> ${task.target} 已恢复到待执行队列。`,
    "info",
  )
  const auditLog = createAuditLog(`${project.name} 重新排队调度任务 ${task.id}`, "已重试", project.name)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txOps: any[] = [
    prisma.schedulerTask.update({ where: { id: taskId }, data: fromSchedulerTaskRecord(nextTask) }),
    prisma.project.update({ where: { id: projectId }, data: fromProjectRecord(nextProject) }),
    prisma.projectDetail.update({ where: { projectId }, data: fromProjectDetailRecord(nextDetail, projectId) }),
    prisma.auditLog.create({ data: fromLogRecord(auditLog) }),
  ]
  if (nextRun) {
    txOps.push(prisma.mcpRun.update({ where: { id: task.runId }, data: fromMcpRunRecord(nextRun) }))
  }

  await prisma.$transaction(txOps)

  return {
    detail: nextDetail,
    project: nextProject,
    run: nextRun,
    task: nextTask,
  }
}
