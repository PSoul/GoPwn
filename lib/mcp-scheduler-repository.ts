import { formatTimestamp } from "@/lib/prototype-record-utils"
import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
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

export function listStoredSchedulerTasks(projectId?: string) {
  const tasks = readPrototypeStore().schedulerTasks

  if (!projectId) {
    return tasks
  }

  return tasks.filter((task) => task.projectId === projectId)
}

export function getStoredSchedulerTaskById(taskId: string) {
  return readPrototypeStore().schedulerTasks.find((task) => task.id === taskId) ?? null
}

export function getStoredSchedulerTaskByRunId(runId: string) {
  return readPrototypeStore().schedulerTasks.find((task) => task.runId === runId) ?? null
}

export function createStoredSchedulerTask(
  run: McpRunRecord,
  input: {
    connectorMode: "local" | "real"
    status: McpSchedulerTaskStatus
    maxAttempts?: number
    availableAt?: string
    summaryLines?: string[]
  },
) {
  const store = readPrototypeStore()
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
    summaryLines: input.summaryLines ?? [...run.summaryLines],
  }

  store.schedulerTasks.unshift(task)
  writePrototypeStore(store)

  return task
}

export function createStoredSchedulerTaskFromRun(
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
          : run.status === "已拒绝"
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

export function updateStoredSchedulerTask(
  taskId: string,
  patch: Partial<
    Pick<
      McpSchedulerTaskRecord,
      | "availableAt"
      | "attempts"
      | "connectorMode"
      | "lastError"
      | "status"
      | "summaryLines"
      | "updatedAt"
    >
  >,
) {
  const store = readPrototypeStore()
  const taskIndex = store.schedulerTasks.findIndex((task) => task.id === taskId)

  if (taskIndex < 0) {
    return null
  }

  const nextTask: McpSchedulerTaskRecord = {
    ...store.schedulerTasks[taskIndex],
    ...patch,
    updatedAt: patch.updatedAt ?? formatTimestamp(),
  }

  store.schedulerTasks[taskIndex] = nextTask
  writePrototypeStore(store)

  return nextTask
}

export function listReadyStoredSchedulerTasks(
  input: {
    projectId?: string
    runId?: string
    now?: string
  } = {},
) {
  const now = input.now ?? formatTimestamp()
  const readyStatuses: McpSchedulerTaskStatus[] = ["ready", "retry_scheduled", "delayed"]

  return listStoredSchedulerTasks(input.projectId)
    .filter((task) => (!input.runId ? true : task.runId === input.runId))
    .filter((task) => readyStatuses.includes(task.status))
    .filter((task) => task.availableAt <= now)
    .sort((left, right) => left.availableAt.localeCompare(right.availableAt))
}
