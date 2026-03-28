import { formatTimestamp } from "@/lib/prototype-record-utils"
import {
  buildDefaultProjectSchedulerControl as buildDefaultLifecycleControl,
  isProjectSchedulerRunning,
  normalizeProjectSchedulerControl,
} from "@/lib/project-scheduler-lifecycle"
import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import { abortActiveExecution } from "@/lib/mcp-execution-runtime"
import type {
  McpRunRecord,
  McpSchedulerTaskRecord,
  ProjectDetailRecord,
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

function getProjectIndexes(projectId: string, store = readPrototypeStore()) {
  return {
    detailIndex: store.projectDetails.findIndex((detail) => detail.projectId === projectId),
    projectIndex: store.projects.findIndex((project) => project.id === projectId),
  }
}

export function getStoredProjectSchedulerControl(projectId: string) {
  const store = readPrototypeStore()
  const project = store.projects.find((item) => item.id === projectId)

  if (!project) {
    return null
  }

  return normalizeProjectSchedulerControl({
    control: store.projectSchedulerControls[projectId],
    projectStatus: project.status,
    updatedAt: project.lastUpdated,
  })
}

export function isStoredProjectSchedulerPaused(projectId: string) {
  return !isProjectSchedulerRunning(getStoredProjectSchedulerControl(projectId))
}

export type ProjectSchedulerControlPatchInput = Partial<
  Pick<ProjectSchedulerControl, "lifecycle" | "note" | "paused">
>

export type ProjectSchedulerControlUpdateResult = {
  detail: ProjectDetailRecord
  project: ReturnType<typeof readPrototypeStore>["projects"][number]
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
): ProjectSchedulerControlUpdateError | null {
  if (current === next) {
    return null
  }

  if (current === "stopped" && next !== "stopped") {
    return {
      error: "Project scheduler lifecycle is already stopped and cannot be restarted.",
      status: 409,
    }
  }

  return null
}

export function updateStoredProjectSchedulerControl(
  projectId: string,
  patch: ProjectSchedulerControlPatchInput,
): ProjectSchedulerControlUpdateResult | ProjectSchedulerControlUpdateError | null {
  const store = readPrototypeStore()
  const { detailIndex, projectIndex } = getProjectIndexes(projectId, store)

  if (detailIndex < 0 || projectIndex < 0) {
    return null
  }

  const timestamp = formatTimestamp()
  const project = store.projects[projectIndex]
  const detail = store.projectDetails[detailIndex]
  const current = normalizeProjectSchedulerControl({
    control: store.projectSchedulerControls[projectId] ?? buildDefaultLifecycleControl(project.lastUpdated, "idle"),
    projectStatus: project.status,
    updatedAt: project.lastUpdated,
  })
  const nextLifecycle = resolveLifecycleFromPatch(current, patch)
  const transitionError = validateLifecycleTransition(current.lifecycle, nextLifecycle)

  if (transitionError) {
    return transitionError
  }

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
    note: patch.note ?? current.note,
    updatedAt: timestamp,
  }

  store.projectSchedulerControls[projectId] = nextControl
  store.projects[projectIndex] = {
    ...project,
    status: changedLifecycle ? getLifecycleStatus(nextLifecycle, project.status) : project.status,
    lastActor: changedLifecycle ? lifecycleMeta.actor : "调度备注更新",
    lastUpdated: timestamp,
  }
  store.projectDetails[detailIndex] = pushProjectActivity(
    detail,
    changedLifecycle ? lifecycleMeta.title : "调度备注已更新",
    changedLifecycle ? `${lifecycleMeta.detailText} ${nextControl.note}` : nextControl.note,
    changedLifecycle ? lifecycleMeta.tone : "info",
  )
  store.auditLogs.unshift(
    createAuditLog(
      `${project.name} 调度${changedLifecycle ? lifecycleMeta.auditSummary : "备注更新"}`,
      changedLifecycle ? lifecycleMeta.auditStatus : "已更新",
      project.name,
    ),
  )
  writePrototypeStore(store)

  return {
    detail: store.projectDetails[detailIndex],
    project: store.projects[projectIndex],
    schedulerControl: nextControl,
    transition: {
      changedLifecycle,
      nextLifecycle,
      previousLifecycle: current.lifecycle,
    },
  }
}

export function stopStoredProjectSchedulerTasks(
  projectId: string,
  reason = "研究员已停止项目，后续不再继续推进。",
) {
  const store = readPrototypeStore()
  let changed = false
  const timestamp = formatTimestamp()
  const nextRuns: McpRunRecord[] = []
  const nextTasks: McpSchedulerTaskRecord[] = []

  for (let index = 0; index < store.schedulerTasks.length; index += 1) {
    const task = store.schedulerTasks[index]

    if (task.projectId !== projectId || !["ready", "retry_scheduled", "delayed", "running"].includes(task.status)) {
      continue
    }

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

    store.schedulerTasks[index] = nextTask
    nextTasks.push(nextTask)
    changed = true

    const runIndex = store.mcpRuns.findIndex((item) => item.id === task.runId)

    if (runIndex >= 0) {
      const nextRun: McpRunRecord = {
        ...store.mcpRuns[runIndex],
        status: "已取消",
        summaryLines: [
          ...store.mcpRuns[runIndex].summaryLines,
          isRunningTask ? `${reason} 平台已请求停止当前执行。` : `${reason} MCP run 已被终止。`,
        ],
        updatedAt: timestamp,
      }
      store.mcpRuns[runIndex] = nextRun
      nextRuns.push(nextRun)
    }

    if (isRunningTask) {
      abortActiveExecution(task.runId, reason)
    }
  }

  if (!changed) {
    return {
      runs: nextRuns,
      tasks: nextTasks,
    }
  }

  writePrototypeStore(store)

  return {
    runs: nextRuns,
    tasks: nextTasks,
  }
}

function updateStoredTaskAndRun(
  store: ReturnType<typeof readPrototypeStore>,
  task: McpSchedulerTaskRecord,
  runPatch: Partial<Pick<McpRunRecord, "status" | "summaryLines" | "updatedAt">> | null,
  nextTask: McpSchedulerTaskRecord,
) {
  const taskIndex = store.schedulerTasks.findIndex((item) => item.id === task.id)

  if (taskIndex >= 0) {
    store.schedulerTasks[taskIndex] = nextTask
  }

  const runIndex = store.mcpRuns.findIndex((item) => item.id === task.runId)

  if (runIndex < 0 || !runPatch) {
    return null
  }

  const nextRun: McpRunRecord = {
    ...store.mcpRuns[runIndex],
    ...runPatch,
    updatedAt: runPatch.updatedAt ?? formatTimestamp(),
  }
  store.mcpRuns[runIndex] = nextRun

  return nextRun
}

export function cancelStoredSchedulerTask(projectId: string, taskId: string, reason = "研究员手动取消当前排队任务。") {
  const store = readPrototypeStore()
  const { detailIndex, projectIndex } = getProjectIndexes(projectId, store)
  const task = store.schedulerTasks.find((item) => item.id === taskId && item.projectId === projectId)

  if (detailIndex < 0 || projectIndex < 0 || !task) {
    return null
  }

  if (!["ready", "retry_scheduled", "delayed", "running"].includes(task.status)) {
    return null
  }

  const timestamp = formatTimestamp()
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
  const nextRun = updateStoredTaskAndRun(
    store,
    task,
    {
      status: "已取消",
      summaryLines: [
        ...(store.mcpRuns.find((item) => item.id === task.runId)?.summaryLines ?? []),
        isRunningTask ? `${reason} 平台已记录停止请求，当前 MCP run 后续不再继续推进。` : `${reason} 调度已终止，不再继续推进该 MCP run。`,
      ],
      updatedAt: timestamp,
    },
    nextTask,
  )
  if (isRunningTask) {
    abortActiveExecution(task.runId, reason)
  }

  const project = store.projects[projectIndex]
  store.projects[projectIndex] = {
    ...project,
    lastActor: "调度取消",
    lastUpdated: timestamp,
  }
  store.projectDetails[detailIndex] = pushProjectActivity(
    store.projectDetails[detailIndex],
    isRunningTask ? "运行任务已记录停止请求" : "调度任务已取消",
    isRunningTask ? `${task.toolName} -> ${task.target} 已停止后续推进并等待当前执行自然收束。` : `${task.toolName} -> ${task.target} 已从运行队列移除。`,
    "warning",
  )
  store.auditLogs.unshift(
    createAuditLog(
      `${project.name} ${isRunningTask ? "请求停止运行任务" : "手动取消调度任务"} ${task.id}`,
      "已取消",
      project.name,
    ),
  )
  writePrototypeStore(store)

  return {
    detail: store.projectDetails[detailIndex],
    project: store.projects[projectIndex],
    run: nextRun,
    task: nextTask,
  }
}

export function retryStoredSchedulerTask(projectId: string, taskId: string, reason = "研究员确认后重新排队。") {
  const store = readPrototypeStore()
  const { detailIndex, projectIndex } = getProjectIndexes(projectId, store)
  const task = store.schedulerTasks.find((item) => item.id === taskId && item.projectId === projectId)

  if (detailIndex < 0 || projectIndex < 0 || !task) {
    return null
  }

  if (task.status !== "failed") {
    return null
  }

  const timestamp = formatTimestamp()
  const nextTask: McpSchedulerTaskRecord = {
    ...task,
    availableAt: timestamp,
    lastError: undefined,
    status: "ready",
    summaryLines: [...task.summaryLines, `${reason} 任务已重新进入待执行队列。`],
    updatedAt: timestamp,
  }
  const nextRun = updateStoredTaskAndRun(
    store,
    task,
    {
      status: "执行中",
      summaryLines: [
        ...(store.mcpRuns.find((item) => item.id === task.runId)?.summaryLines ?? []),
        `${reason} MCP run 已重新排队，等待调度器再次执行。`,
      ],
      updatedAt: timestamp,
    },
    nextTask,
  )

  const project = store.projects[projectIndex]
  store.projects[projectIndex] = {
    ...project,
    lastActor: "调度重试",
    lastUpdated: timestamp,
  }
  store.projectDetails[detailIndex] = pushProjectActivity(
    store.projectDetails[detailIndex],
    "失败任务已重新排队",
    `${task.toolName} -> ${task.target} 已恢复到待执行队列。`,
    "info",
  )
  store.auditLogs.unshift(createAuditLog(`${project.name} 重新排队调度任务 ${task.id}`, "已重试", project.name))
  writePrototypeStore(store)

  return {
    detail: store.projectDetails[detailIndex],
    project: store.projects[projectIndex],
    run: nextRun,
    task: nextTask,
  }
}
