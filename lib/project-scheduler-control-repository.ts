import { formatTimestamp } from "@/lib/prototype-record-utils"
import { prisma } from "@/lib/prisma"
import {
  fromLogRecord,
  fromProjectDetailRecord,
  fromProjectRecord,
  fromProjectSchedulerControlRecord,
  toMcpRunRecord,
  toProjectDetailRecord,
  toProjectRecord,
  toProjectSchedulerControlRecord,
  toSchedulerTaskRecord,
  fromSchedulerTaskRecord,
  fromMcpRunRecord,
} from "@/lib/prisma-transforms"
import {
  buildDefaultProjectSchedulerControl as buildDefaultLifecycleControl,
  isProjectSchedulerRunning,
  normalizeProjectSchedulerControl,
} from "@/lib/project-scheduler-lifecycle"
import { abortActiveExecution } from "@/lib/mcp-execution-runtime"
import type {
  McpRunRecord,
  McpSchedulerTaskRecord,
  ProjectDetailRecord,
  ProjectRecord,
  ProjectSchedulerControl,
  ProjectSchedulerLifecycle,
} from "@/lib/prototype-types"

function createAuditLog(summary: string, status: string, projectName?: string) {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    category: "调度控制",
    summary,
    projectName,
    actor: "研究员",
    timestamp: formatTimestamp(),
    status,
  }
}

function pushProjectActivity(
  detail: ProjectDetailRecord,
  title: string,
  detailText: string,
  tone: "success" | "warning" | "danger" | "info",
) {
  return {
    ...detail,
    activity: [
      {
        title,
        detail: detailText,
        meta: "调度控制",
        tone,
      },
      ...detail.activity,
    ].slice(0, 8),
    currentStage: {
      ...detail.currentStage,
      updatedAt: formatTimestamp(),
    },
  }
}

export async function getStoredProjectSchedulerControl(projectId: string) {
  const projectRow = await prisma.project.findUnique({ where: { id: projectId } })
  if (!projectRow) return null
  const project = toProjectRecord(projectRow)
  const controlRow = await prisma.projectSchedulerControl.findUnique({ where: { projectId } })
  const control = controlRow ? toProjectSchedulerControlRecord(controlRow) : undefined
  return normalizeProjectSchedulerControl({
    control,
    projectStatus: project.status,
    updatedAt: project.lastUpdated,
  })
}

export async function isStoredProjectSchedulerPaused(projectId: string) {
  return !isProjectSchedulerRunning(await getStoredProjectSchedulerControl(projectId))
}

export type ProjectSchedulerControlPatchInput = Partial<
  Pick<ProjectSchedulerControl, "lifecycle" | "note" | "paused" | "autoReplan" | "maxRounds">
>

export type ProjectSchedulerControlUpdateResult = {
  detail: ProjectDetailRecord
  project: ProjectRecord
  schedulerControl: ProjectSchedulerControl
  transition: {
    changedLifecycle: boolean
    nextLifecycle: ProjectSchedulerLifecycle
    previousLifecycle: ProjectSchedulerLifecycle
  }
}

export type ProjectSchedulerControlUpdateError = {
  error: string
  status: number
}

function resolveLifecycleFromPatch(
  current: ProjectSchedulerControl,
  patch: ProjectSchedulerControlPatchInput,
): ProjectSchedulerLifecycle {
  if (patch.lifecycle) {
    return patch.lifecycle
  }

  if (typeof patch.paused === "boolean") {
    if (current.lifecycle === "stopped") {
      return "stopped"
    }

    if (patch.paused) {
      return "paused"
    }

    return current.lifecycle === "paused" ? "running" : current.lifecycle
  }

  return current.lifecycle
}

function getLifecycleStatus(nextLifecycle: ProjectSchedulerLifecycle, currentProjectStatus: string) {
  if (currentProjectStatus === "已完成") {
    return "已完成" as const
  }

  switch (nextLifecycle) {
    case "idle":
      return "待处理" as const
    case "running":
      return "运行中" as const
    case "paused":
      return "已暂停" as const
    case "stopped":
      return "已停止" as const
  }
}

function getLifecycleMeta(nextLifecycle: ProjectSchedulerLifecycle) {
  switch (nextLifecycle) {
    case "idle":
      return {
        actor: "等待开始",
        auditStatus: "待开始",
        auditSummary: "等待手动开始",
        detailText: "项目已回到待开始状态，LLM 与调度器暂不推进新动作。",
        title: "项目等待手动开始",
        tone: "warning" as const,
      }
    case "running":
      return {
        actor: "调度运行",
        auditStatus: "运行中",
        auditSummary: "开始/恢复运行",
        detailText: "研究员已允许继续运行，LLM 与调度器可以继续推进后续动作。",
        title: "项目已进入运行态",
        tone: "success" as const,
      }
    case "paused":
      return {
        actor: "调度暂停",
        auditStatus: "已暂停",
        auditSummary: "暂停运行",
        detailText: "平台已暂停新的 LLM 编排和调度认领，等待研究员恢复。",
        title: "项目已暂停",
        tone: "warning" as const,
      }
    case "stopped":
      return {
        actor: "项目停止",
        auditStatus: "已停止",
        auditSummary: "终止项目",
        detailText: "项目已被终止，后续不会再重新开始。",
        title: "项目已停止",
        tone: "danger" as const,
      }
  }
}

function validateLifecycleTransition(
  current: ProjectSchedulerLifecycle,
  next: ProjectSchedulerLifecycle,
  currentProjectStatus: string,
): ProjectSchedulerControlUpdateError | null {
  if (current === next) {
    return null
  }

  if (currentProjectStatus === "已完成") {
    return {
      error: "Project scheduler lifecycle is already completed and cannot be restarted.",
      status: 409,
    }
  }

  if (current === "stopped" && next !== "stopped") {
    return {
      error: "Project scheduler lifecycle is already stopped and cannot be restarted.",
      status: 409,
    }
  }

  return null
}

export async function updateStoredProjectSchedulerControl(
  projectId: string,
  patch: ProjectSchedulerControlPatchInput,
): Promise<ProjectSchedulerControlUpdateResult | ProjectSchedulerControlUpdateError | null> {
  const projectRow = await prisma.project.findUnique({ where: { id: projectId } })
  const detailRow = await prisma.projectDetail.findUnique({ where: { projectId } })
  if (!projectRow || !detailRow) return null

  const timestamp = formatTimestamp()
  const project = toProjectRecord(projectRow)
  const detail = toProjectDetailRecord(detailRow)
  const controlRow = await prisma.projectSchedulerControl.findUnique({ where: { projectId } })
  const current = normalizeProjectSchedulerControl({
    control: controlRow ? toProjectSchedulerControlRecord(controlRow) : buildDefaultLifecycleControl(project.lastUpdated, "idle"),
    projectStatus: project.status,
    updatedAt: project.lastUpdated,
  })
  const nextLifecycle = resolveLifecycleFromPatch(current, patch)
  const transitionError = validateLifecycleTransition(current.lifecycle, nextLifecycle, project.status)

  if (transitionError) return transitionError

  const changedLifecycle = nextLifecycle !== current.lifecycle
  const lifecycleMeta = getLifecycleMeta(nextLifecycle)
  const lifecycleFromPatch = typeof patch.lifecycle === "string"
  const nextControl: ProjectSchedulerControl = {
    ...current,
    ...patch,
    lifecycle: nextLifecycle,
    paused: lifecycleFromPatch
      ? nextLifecycle === "paused" || nextLifecycle === "stopped"
      : typeof patch.paused === "boolean"
        ? nextLifecycle === "running"
          ? patch.paused
          : nextLifecycle === "paused" || nextLifecycle === "stopped"
        : nextLifecycle === "paused" || nextLifecycle === "stopped",
    autoReplan: typeof patch.autoReplan === "boolean" ? patch.autoReplan : current.autoReplan,
    maxRounds: typeof patch.maxRounds === "number" ? patch.maxRounds : current.maxRounds,
    note: patch.note ?? current.note,
    updatedAt: timestamp,
  }

  const nextProject: typeof project = {
    ...project,
    status: changedLifecycle ? getLifecycleStatus(nextLifecycle, project.status) : project.status,
    lastActor: changedLifecycle ? lifecycleMeta.actor : "调度备注更新",
    lastUpdated: timestamp,
  }
  const nextDetail = pushProjectActivity(
    detail,
    changedLifecycle ? lifecycleMeta.title : "调度备注已更新",
    changedLifecycle ? `${lifecycleMeta.detailText} ${nextControl.note}` : nextControl.note,
    changedLifecycle ? lifecycleMeta.tone : "info",
  )
  const auditLog = createAuditLog(
    `${project.name} 调度${changedLifecycle ? lifecycleMeta.auditSummary : "备注更新"}`,
    changedLifecycle ? lifecycleMeta.auditStatus : "已更新",
    project.name,
  )

  await prisma.$transaction([
    controlRow
      ? prisma.projectSchedulerControl.update({
          where: { projectId },
          data: fromProjectSchedulerControlRecord(nextControl, projectId),
        })
      : prisma.projectSchedulerControl.create({
          data: fromProjectSchedulerControlRecord(nextControl, projectId),
        }),
    prisma.project.update({ where: { id: projectId }, data: fromProjectRecord(nextProject) }),
    prisma.projectDetail.update({
      where: { projectId },
      data: fromProjectDetailRecord(nextDetail, projectId),
    }),
    prisma.auditLog.create({ data: fromLogRecord(auditLog) }),
  ])

  return {
    detail: nextDetail,
    project: nextProject,
    schedulerControl: nextControl,
    transition: {
      changedLifecycle,
      nextLifecycle,
      previousLifecycle: current.lifecycle,
    },
  }
}

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
    isRunningTask ? `${task.toolName} -> ${task.target} 已停止后续推进并等待当前执行自然收束。` : `${task.toolName} -> ${task.target} 已从运行队列移除。`,
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
