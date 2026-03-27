import { formatTimestamp } from "@/lib/prototype-record-utils"
import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import { abortActiveExecution } from "@/lib/mcp-execution-runtime"
import type {
  McpRunRecord,
  McpSchedulerTaskRecord,
  ProjectDetailRecord,
  ProjectSchedulerControl,
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

function buildDefaultProjectSchedulerControl(updatedAt = formatTimestamp()): ProjectSchedulerControl {
  return {
    paused: false,
    note: "默认允许调度器处理 ready / retry / delayed 任务。",
    updatedAt,
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
  return store.projectSchedulerControls[projectId] ?? null
}

export function isStoredProjectSchedulerPaused(projectId: string) {
  return getStoredProjectSchedulerControl(projectId)?.paused ?? false
}

export function updateStoredProjectSchedulerControl(
  projectId: string,
  patch: Partial<Pick<ProjectSchedulerControl, "note" | "paused">>,
) {
  const store = readPrototypeStore()
  const { detailIndex, projectIndex } = getProjectIndexes(projectId, store)

  if (detailIndex < 0 || projectIndex < 0) {
    return null
  }

  const timestamp = formatTimestamp()
  const project = store.projects[projectIndex]
  const detail = store.projectDetails[detailIndex]
  const current = store.projectSchedulerControls[projectId] ?? buildDefaultProjectSchedulerControl(project.lastUpdated)
  const nextControl: ProjectSchedulerControl = {
    ...current,
    ...patch,
    note: patch.note ?? current.note,
    updatedAt: timestamp,
  }

  store.projectSchedulerControls[projectId] = nextControl
  store.projects[projectIndex] = {
    ...project,
    lastActor: nextControl.paused ? "调度暂停" : "调度恢复",
    lastUpdated: timestamp,
  }
  store.projectDetails[detailIndex] = pushProjectActivity(
    detail,
    nextControl.paused ? "项目调度已暂停" : "项目调度已恢复",
    nextControl.note,
    nextControl.paused ? "warning" : "success",
  )
  store.auditLogs.unshift(
    createAuditLog(
      `${project.name} 调度${nextControl.paused ? "暂停" : "恢复"}`,
      nextControl.paused ? "已暂停" : "已恢复",
      project.name,
    ),
  )
  writePrototypeStore(store)

  return {
    detail: store.projectDetails[detailIndex],
    project: store.projects[projectIndex],
    schedulerControl: nextControl,
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
