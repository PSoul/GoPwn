import { formatTimestamp } from "@/lib/prototype-record-utils"
import { prisma } from "@/lib/infra/prisma"
import {
  fromLogRecord,
  fromProjectDetailRecord,
  fromProjectRecord,
  fromProjectSchedulerControlRecord,
  toProjectDetailRecord,
  toProjectRecord,
  toProjectSchedulerControlRecord,
} from "@/lib/infra/prisma-transforms"
import {
  buildDefaultProjectSchedulerControl as buildDefaultLifecycleControl,
  isProjectSchedulerRunning,
  normalizeProjectSchedulerControl,
} from "@/lib/project/project-scheduler-lifecycle"
import { createAuditLog, pushProjectActivity } from "./scheduler-control-helpers"
import type {
  ProjectDetailRecord,
  ProjectRecord,
  ProjectSchedulerControl,
  ProjectSchedulerLifecycle,
} from "@/lib/prototype-types"

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
      return "待启动" as const
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
        auditSummary: "等待启动",
        detailText: "项目已回到待开始状态，LLM 与调度器暂不推进新动作。",
        title: "项目等待启动",
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
        detailText: "平台已暂停新的 AI 规划和任务认领，等待研究员恢复。",
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
