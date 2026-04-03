import { defaultGlobalApprovalControl } from "@/lib/settings/platform-config"
import { prisma } from "@/lib/infra/prisma"
import {
  fromLogRecord,
  fromProjectDetailRecord,
  fromProjectFormPresetRecord,
  fromProjectRecord,
  fromProjectSchedulerControlRecord,
  toProjectDetailRecord,
  toProjectFormPresetRecord,
  toProjectRecord,
} from "@/lib/infra/prisma-transforms"
import { buildProjectClosureStatus } from "@/lib/project/project-closure-status"
import { buildDefaultProjectSchedulerControl } from "@/lib/project/project-scheduler-lifecycle"
import { normalizeProjectTargets, SINGLE_USER_LABEL } from "@/lib/project/project-targets"
import { generateProjectId } from "@/lib/project/project-id"
import type {
  LogRecord,
  ProjectDetailRecord,
  ProjectFormPreset,
  ProjectMutationInput,
  ProjectPatchInput,
  ProjectRecord,
  ProjectStatus,
} from "@/lib/prototype-types"

function formatTimestamp(date = new Date()) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function formatDayStamp(date = new Date()) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}${month}${day}`
}

function buildProjectId() {
  return generateProjectId()
}

function buildProjectCode(existingProjects: ProjectRecord[]) {
  return `PRJ-${formatDayStamp()}-${String(existingProjects.length + 1).padStart(3, "0")}`
}

function buildProjectFormPreset(input: ProjectMutationInput): ProjectFormPreset {
  return {
    name: input.name,
    targetInput: input.targetInput,
    description: input.description,
  }
}

function buildProjectSummary(input: ProjectMutationInput, targets: string[]) {
  const targetCount = targets.length
  const targetLabel = targetCount > 0 ? `${targetCount} 个目标` : "目标"

  return `${targetLabel}已录入，等待启动后交给 LLM 拆分任务并驱动 MCP。`
}

function buildProjectRecord(input: ProjectMutationInput, existingProjects: ProjectRecord[]): ProjectRecord {
  const timestamp = formatTimestamp()
  const targets = normalizeProjectTargets(input.targetInput)

  return {
    id: buildProjectId(),
    code: buildProjectCode(existingProjects),
    name: input.name,
    targetInput: input.targetInput,
    targets,
    description: input.description,
    stage: "种子目标接收",
    status: "待启动",
    pendingApprovals: 0,
    openTasks: 1,
    assetCount: 0,
    evidenceCount: 0,
    createdAt: timestamp,
    lastUpdated: timestamp,
    lastActor: "项目创建",
    riskSummary: "项目已创建，尚未开始返回真实资产或漏洞结果。",
    summary: buildProjectSummary(input, targets),
  }
}

function buildProjectDetail(project: ProjectRecord, approvalMode?: string): ProjectDetailRecord {
  const closureStatus = buildProjectClosureStatus({
    finalConclusionGenerated: false,
    lifecycle: "idle",
    pendingApprovals: 0,
    projectStatus: project.status,
    queuedTaskCount: 0,
    reportExported: false,
    runningTaskCount: 0,
    waitingApprovalTaskCount: 0,
  })

  return {
    projectId: project.id,
    target: project.targetInput,
    blockingReason: "项目已创建但尚未启动，LLM 与 MCP 仍未接管目标。",
    nextStep: "进入任务与调度页启动项目，让 LLM 基于目标生成首轮计划。",
    reflowNotice: "项目开始后，新域名、IP、端口、指纹和漏洞线索会持续同步到当前工作台。",
    currentFocus: "先确认目标和项目说明，再决定何时启动项目。",
    timeline: [
      { title: "种子目标接收", state: "current", note: "等待启动。" },
      { title: "持续信息收集", state: "watching", note: "项目开始后，LLM 会先发起低风险整理与信息收集。" },
      { title: "发现与指纹识别", state: "watching", note: "识别到资产后会开始补充端口、服务和指纹表格。" },
    ],
    tasks: [
      {
        id: `task-${project.id}-001`,
        projectId: project.id,
        title: "等待研究员开始项目后生成首批任务",
        status: "pending",
        reason: "当前仅保存了目标与项目说明，还没有将目标发送给 LLM 进行真实规划。",
        priority: "P1",
        owner: SINGLE_USER_LABEL,
        updatedAt: project.lastUpdated,
        linkedTarget: project.targets[0],
      },
    ],
    discoveredInfo: [
      {
        title: "项目说明",
        detail: project.description,
        meta: project.lastUpdated,
        tone: "info",
      },
      {
        title: "目标录入完成",
        detail: project.targets.join(" / ") || "等待目标输入",
        meta: project.lastUpdated,
        tone: "neutral",
      },
    ],
    serviceSurface: [],
    fingerprints: [],
    entries: [],
    scheduler: [
      {
        title: "等待启动",
        detail: "启动后 LLM 将接管目标并生成真实 MCP 调度。",
        meta: "pending",
        tone: "warning",
      },
    ],
    activity: [
      {
        title: "项目创建完成",
        detail: "项目已进入工作台，等待研究员决定何时开始执行。",
        meta: project.lastUpdated,
        tone: "success",
      },
    ],
    resultMetrics: [
      { label: "域名", value: "0", note: "等待识别", tone: "neutral" },
      { label: "站点", value: "0", note: "等待识别", tone: "neutral" },
      { label: "开放端口", value: "0", note: "等待识别", tone: "neutral" },
      { label: "漏洞线索", value: "0", note: "等待验证", tone: "neutral" },
    ],
    assetGroups: [
      {
        title: "域名 / Web 入口",
        description: "域名、站点、后台入口和路径入口会汇总到该表。",
        count: "0 项",
        items: [],
      },
      {
        title: "IP / 端口 / 服务",
        description: "IP、端口、协议和服务画像会汇总到该表。",
        count: "0 项",
        items: [],
      },
    ],
    findings: [],
    currentStage: {
      title: "种子目标接收",
      summary: "等待启动后根据输入目标展开真实规划。",
      blocker: "尚未开始，因此还没有任何真实资产、证据或漏洞结果。",
      owner: SINGLE_USER_LABEL,
      updatedAt: project.lastUpdated,
    },
    approvalControl: approvalMode === "auto"
      ? {
          enabled: false,
          mode: "全自动执行",
          autoApproveLowRisk: true,
          description: "该项目已设置为全自动执行，所有工具调用将直接运行，不进入审批队列。",
          note: "",
        }
      : {
          enabled: defaultGlobalApprovalControl.enabled,
          mode: defaultGlobalApprovalControl.mode,
          autoApproveLowRisk: defaultGlobalApprovalControl.autoApproveLowRisk,
          description: "审批开关由系统设置与 MCP 工具契约统一控制，项目页只展示当前生效状态。",
          note: defaultGlobalApprovalControl.note,
        },
    closureStatus,
    finalConclusion: null,
  }
}

function createAuditLog(summary: string, project: ProjectRecord, status = "已记录"): LogRecord {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    category: "项目管理",
    summary,
    projectName: project.name,
    actor: SINGLE_USER_LABEL,
    timestamp: formatTimestamp(),
    status,
  }
}

function mergeProjectRecord(project: ProjectRecord, patch: ProjectPatchInput): ProjectRecord {
  const nextTargetInput = patch.targetInput ?? project.targetInput
  const nextDescription = patch.description ?? project.description
  const targets = normalizeProjectTargets(nextTargetInput)

  return {
    ...project,
    name: patch.name ?? project.name,
    targetInput: nextTargetInput,
    targets,
    description: nextDescription,
    summary: buildProjectSummary(
      {
        name: patch.name ?? project.name,
        targetInput: nextTargetInput,
        description: nextDescription,
      },
      targets,
    ),
    lastUpdated: formatTimestamp(),
    lastActor: "项目编辑",
  }
}

function mergeProjectFormPreset(preset: ProjectFormPreset, patch: ProjectPatchInput): ProjectFormPreset {
  return {
    name: patch.name ?? preset.name,
    targetInput: patch.targetInput ?? preset.targetInput,
    description: patch.description ?? preset.description,
  }
}

function updateProjectDetail(detail: ProjectDetailRecord, project: ProjectRecord): ProjectDetailRecord {
  const nextDiscoveredInfo = detail.discoveredInfo.filter((item) => item.title !== "项目说明" && item.title !== "目标录入完成")
  const waitingToStart = project.status === "待启动"
  const closureStatus = buildProjectClosureStatus({
    finalConclusionGenerated: detail.finalConclusion !== null || detail.closureStatus.finalConclusionGenerated,
    lifecycle: waitingToStart ? "idle" : "running",
    pendingApprovals: project.pendingApprovals,
    projectStatus: project.status,
    queuedTaskCount: 0,
    reportExported: detail.closureStatus.reportExported,
    runningTaskCount: 0,
    waitingApprovalTaskCount: 0,
  })

  return {
    ...detail,
    target: project.targetInput,
    blockingReason:
      detail.assetGroups.some((group) => group.items.length > 0) || detail.findings.length > 0
        ? detail.blockingReason
        : waitingToStart
          ? "需要启动后才会进入真实执行。"
        : "项目已更新，但仍在等待第一批真实结果返回。",
    nextStep: waitingToStart
      ? "如果目标已确认无误，请进入任务与调度页启动项目。"
      : "围绕最新目标继续观察结果表、阶段流转和任务调度是否发生变化。",
    currentFocus: waitingToStart
      ? "优先确认目标与项目说明，然后决定何时启动。"
      : "优先查看目标内容是否需要补充，以及首轮结果是否已经开始沉淀。",
    discoveredInfo: [
      {
        title: "项目说明",
        detail: project.description,
        meta: project.lastUpdated,
        tone: "info",
      },
      {
        title: "目标录入完成",
        detail: project.targets.join(" / ") || "等待目标输入",
        meta: project.lastUpdated,
        tone: "neutral",
      },
      ...nextDiscoveredInfo,
    ],
    currentStage: {
      ...detail.currentStage,
      summary: waitingToStart ? "仍在等待启动。" : detail.currentStage.summary,
      updatedAt: project.lastUpdated,
      owner: SINGLE_USER_LABEL,
    },
    closureStatus,
    finalConclusion: detail.finalConclusion ?? null,
    tasks: detail.tasks.map((task, index) =>
      index === 0
        ? {
            ...task,
            owner: SINGLE_USER_LABEL,
            updatedAt: project.lastUpdated,
            linkedTarget: project.targets[0],
          }
        : task,
    ),
  }
}

export async function createStoredProject(input: ProjectMutationInput) {
  const allProjects = await prisma.project.findMany()
  const existingRecords = allProjects.map(toProjectRecord)
  const project = buildProjectRecord(input, existingRecords)
  const preset = buildProjectFormPreset(input)
  const detail = buildProjectDetail(project, input.approvalMode)
  const control = buildDefaultProjectSchedulerControl(project.lastUpdated, "idle")
  const auditLog = createAuditLog(`创建项目 ${project.name}`, project, "已完成")

  await prisma.$transaction([
    prisma.project.create({ data: fromProjectRecord(project) }),
    prisma.projectDetail.create({ data: fromProjectDetailRecord(detail, project.id) }),
    prisma.projectFormPreset.create({ data: fromProjectFormPresetRecord(preset, project.id) }),
    prisma.projectSchedulerControl.create({ data: fromProjectSchedulerControlRecord(control, project.id) }),
    prisma.auditLog.create({ data: fromLogRecord(auditLog) }),
  ])

  return { detail, project }
}

export async function updateStoredProject(projectId: string, patch: ProjectPatchInput) {
  const projectRow = await prisma.project.findUnique({ where: { id: projectId } })
  if (!projectRow) return null
  const presetRow = await prisma.projectFormPreset.findUnique({ where: { projectId } })
  if (!presetRow) return null

  const currentProject = toProjectRecord(projectRow)
  const currentPreset = toProjectFormPresetRecord(presetRow)
  const nextProject = mergeProjectRecord(currentProject, patch)
  const nextPreset = mergeProjectFormPreset(currentPreset, patch)

  const detailRow = await prisma.projectDetail.findUnique({ where: { projectId } })
  const nextDetail = detailRow
    ? updateProjectDetail(toProjectDetailRecord(detailRow), nextProject)
    : buildProjectDetail(nextProject)

  const auditLog = createAuditLog(`更新项目 ${nextProject.name}`, nextProject, "已完成")

  await prisma.$transaction([
    prisma.project.update({ where: { id: projectId }, data: fromProjectRecord(nextProject) }),
    prisma.projectFormPreset.update({
      where: { projectId },
      data: fromProjectFormPresetRecord(nextPreset, projectId),
    }),
    detailRow
      ? prisma.projectDetail.update({
          where: { projectId },
          data: fromProjectDetailRecord(nextDetail, projectId),
        })
      : prisma.projectDetail.create({ data: fromProjectDetailRecord(nextDetail, projectId) }),
    prisma.auditLog.create({ data: fromLogRecord(auditLog) }),
  ])

  return { detail: nextDetail, project: nextProject }
}

export async function archiveStoredProject(projectId: string) {
  const projectRow = await prisma.project.findUnique({ where: { id: projectId } })
  if (!projectRow) return null

  const currentProject = toProjectRecord(projectRow)
  const archivedStatus: ProjectStatus = "已完成"
  const archivedProject: ProjectRecord = {
    ...currentProject,
    status: archivedStatus,
    stage: "报告与回归验证",
    pendingApprovals: 0,
    openTasks: 0,
    lastUpdated: formatTimestamp(),
    lastActor: "项目归档",
    riskSummary: "项目已归档，后续仅保留结果、证据和审计回溯能力。",
  }

  const detailRow = await prisma.projectDetail.findUnique({ where: { projectId } })
  const existingDetail = detailRow ? toProjectDetailRecord(detailRow) : null
  const archivedDetail: ProjectDetailRecord = existingDetail
    ? {
        ...existingDetail,
        blockingReason: "项目已归档，不再继续派发新任务。",
        nextStep: '如需恢复，可在后续版本补充"重新激活"能力。',
        currentFocus: "保留结果、审计与证据回溯。",
        currentStage: {
          ...existingDetail.currentStage,
          title: "报告与回归验证",
          summary: "项目已完成当前周期并被归档。",
          blocker: "归档后不再继续调度新动作。",
          owner: SINGLE_USER_LABEL,
          updatedAt: archivedProject.lastUpdated,
        },
        closureStatus: buildProjectClosureStatus({
          finalConclusionGenerated: existingDetail.finalConclusion !== null,
          lifecycle: "idle",
          pendingApprovals: 0,
          projectStatus: archivedProject.status,
          queuedTaskCount: 0,
          reportExported: existingDetail.closureStatus.reportExported,
          runningTaskCount: 0,
          waitingApprovalTaskCount: 0,
        }),
      }
    : buildProjectDetail(archivedProject)

  const auditLog = createAuditLog(`归档项目 ${archivedProject.name}`, archivedProject, "已记录")

  await prisma.$transaction([
    prisma.project.update({ where: { id: projectId }, data: fromProjectRecord(archivedProject) }),
    detailRow
      ? prisma.projectDetail.update({
          where: { projectId },
          data: fromProjectDetailRecord(archivedDetail, projectId),
        })
      : prisma.projectDetail.create({ data: fromProjectDetailRecord(archivedDetail, projectId) }),
    prisma.auditLog.create({ data: fromLogRecord(auditLog) }),
  ])

  return { detail: archivedDetail, project: archivedProject }
}
