import { defaultGlobalApprovalControl } from "@/lib/platform-config"
import { prisma } from "@/lib/prisma"
import {
  fromLogRecord,
  fromProjectDetailRecord,
  fromProjectFormPresetRecord,
  fromProjectRecord,
  fromProjectSchedulerControlRecord,
  toProjectDetailRecord,
  toProjectFormPresetRecord,
  toProjectRecord,
  toLogRecord,
} from "@/lib/prisma-transforms"
import { buildProjectClosureStatus } from "@/lib/project-closure-status"
import { buildDefaultProjectSchedulerControl } from "@/lib/project-scheduler-lifecycle"
import { normalizeProjectTargets, SINGLE_USER_LABEL } from "@/lib/project-targets"
import { generateProjectId } from "@/lib/project-id"
import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import type {
  LogRecord,
  ProjectDetailRecord,
  ProjectFormPreset,
  ProjectMutationInput,
  ProjectPatchInput,
  ProjectRecord,
  ProjectStatus,
} from "@/lib/prototype-types"

const USE_PRISMA = process.env.DATA_LAYER === "prisma"

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

  return `${targetLabel}已录入，等待研究员手动开始后再交给 LLM 拆分任务并驱动 MCP。`
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
    status: "待处理",
    pendingApprovals: 0,
    openTasks: 1,
    assetCount: 0,
    evidenceCount: 0,
    createdAt: timestamp,
    lastUpdated: timestamp,
    lastActor: "项目创建",
    riskSummary: "项目已创建，尚未开始回流真实资产或漏洞结果。",
    summary: buildProjectSummary(input, targets),
  }
}

function buildProjectDetail(project: ProjectRecord): ProjectDetailRecord {
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
    blockingReason: "项目已创建，但还没有手动开始，LLM 与 MCP 仍未接管目标。",
    nextStep: "进入任务与调度页，手动开始项目后再让 LLM 基于目标生成首轮计划。",
    reflowNotice: "项目开始后，新域名、IP、端口、指纹和漏洞线索会持续回流到当前工作台。",
    currentFocus: "先确认目标和项目说明，再决定何时手动开始项目。",
    timeline: [
      { title: "种子目标接收", state: "current", note: "项目已创建，等待研究员手动开始。" },
      { title: "持续信息收集", state: "watching", note: "项目开始后，LLM 会先发起低风险整理与信息收集。" },
      { title: "发现与指纹识别", state: "watching", note: "识别到资产后会开始补充端口、服务和指纹表格。" },
    ],
    tasks: [
      {
        id: `task-${project.id}-001`,
        projectId: project.id,
        title: "等待研究员开始项目后生成首批任务",
        status: "pending",
        reason: "当前仅保存了目标与项目说明，还没有将目标发送给 LLM 进行真实编排。",
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
        title: "等待手动开始",
        detail: "只有在研究员手动开始后，LLM 才会接管目标并生成真实 MCP 调度。",
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
      { label: "已发现资产", value: "0", note: "等待资产回流", tone: "neutral" },
      { label: "已发现漏洞", value: "0", note: "等待结果沉淀", tone: "neutral" },
      { label: "证据锚点", value: "0", note: "等待证据归档", tone: "neutral" },
      { label: "待审批动作", value: "0", note: "等待风险动作产生", tone: "neutral" },
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
      summary: "项目已创建，等待手动开始后再根据输入目标展开真实编排。",
      blocker: "尚未开始，因此还没有任何真实资产、证据或漏洞结果。",
      owner: SINGLE_USER_LABEL,
      updatedAt: project.lastUpdated,
    },
    approvalControl: {
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
  const waitingToStart = project.status === "待处理"
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
          ? "项目已更新，但仍然需要研究员手动开始后才会进入真实执行。"
        : "项目已更新，但仍在等待第一批真实结果回流。",
    nextStep: waitingToStart
      ? "如果目标已经确认无误，请进入任务与调度页手动开始项目。"
      : "围绕最新目标继续观察结果表、阶段流转和任务调度是否发生变化。",
    currentFocus: waitingToStart
      ? "优先确认目标与项目说明，然后决定何时手动开始。"
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
      summary: waitingToStart ? "项目已更新，仍然等待手动开始。" : detail.currentStage.summary,
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

export async function listStoredProjects() {
  if (USE_PRISMA) {
    const rows = await prisma.project.findMany({ orderBy: { lastUpdated: "desc" } })
    return rows.map(toProjectRecord)
  }

  return readPrototypeStore().projects
}

export async function getStoredProjectById(projectId: string) {
  if (USE_PRISMA) {
    const row = await prisma.project.findUnique({ where: { id: projectId } })
    return row ? toProjectRecord(row) : null
  }

  return readPrototypeStore().projects.find((project) => project.id === projectId) ?? null
}

export async function getStoredProjectDetailById(projectId: string) {
  if (USE_PRISMA) {
    const row = await prisma.projectDetail.findUnique({ where: { projectId } })
    return row ? toProjectDetailRecord(row) : null
  }

  return readPrototypeStore().projectDetails.find((detail) => detail.projectId === projectId) ?? null
}

export async function getStoredProjectFormPreset(projectId?: string) {
  if (USE_PRISMA) {
    if (!projectId) {
      const firstProject = await prisma.project.findFirst({ orderBy: { lastUpdated: "desc" } })
      if (!firstProject) return null
      projectId = firstProject.id
    }
    const row = await prisma.projectFormPreset.findUnique({ where: { projectId } })
    return row ? toProjectFormPresetRecord(row) : null
  }

  const store = readPrototypeStore()

  if (!projectId) {
    return store.projectFormPresets[store.projects[0]?.id] ?? null
  }

  return store.projectFormPresets[projectId] ?? null
}

export async function listStoredAuditLogs() {
  if (USE_PRISMA) {
    const rows = await prisma.auditLog.findMany({ orderBy: { timestamp: "desc" } })
    return rows.map(toLogRecord)
  }

  return readPrototypeStore().auditLogs
}

export async function createStoredProject(input: ProjectMutationInput) {
  if (USE_PRISMA) {
    const allProjects = await prisma.project.findMany()
    const existingRecords = allProjects.map(toProjectRecord)
    const project = buildProjectRecord(input, existingRecords)
    const preset = buildProjectFormPreset(input)
    const detail = buildProjectDetail(project)
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

  const store = readPrototypeStore()
  const project = buildProjectRecord(input, store.projects)
  const preset = buildProjectFormPreset(input)
  const detail = buildProjectDetail(project)

  store.projects.unshift(project)
  store.projectDetails.unshift(detail)
  store.projectFormPresets[project.id] = preset
  store.projectSchedulerControls[project.id] = buildDefaultProjectSchedulerControl(project.lastUpdated, "idle")
  store.auditLogs.unshift(createAuditLog(`创建项目 ${project.name}`, project, "已完成"))
  writePrototypeStore(store)

  return { detail, project }
}

export async function updateStoredProject(projectId: string, patch: ProjectPatchInput) {
  if (USE_PRISMA) {
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

  const store = readPrototypeStore()
  const projectIndex = store.projects.findIndex((project) => project.id === projectId)

  if (projectIndex < 0) {
    return null
  }

  const currentProject = store.projects[projectIndex]
  const currentPreset = store.projectFormPresets[projectId]

  if (!currentPreset) {
    return null
  }

  const nextProject = mergeProjectRecord(currentProject, patch)
  const nextPreset = mergeProjectFormPreset(currentPreset, patch)
  const detailIndex = store.projectDetails.findIndex((detail) => detail.projectId === projectId)
  const nextDetail =
    detailIndex >= 0
      ? updateProjectDetail(store.projectDetails[detailIndex], nextProject)
      : buildProjectDetail(nextProject)

  store.projects[projectIndex] = nextProject
  store.projectFormPresets[projectId] = nextPreset

  if (detailIndex >= 0) {
    store.projectDetails[detailIndex] = nextDetail
  } else {
    store.projectDetails.unshift(nextDetail)
  }

  store.auditLogs.unshift(createAuditLog(`更新项目 ${nextProject.name}`, nextProject, "已完成"))
  writePrototypeStore(store)

  return { detail: nextDetail, project: nextProject }
}

export async function archiveStoredProject(projectId: string) {
  if (USE_PRISMA) {
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

  const store = readPrototypeStore()
  const projectIndex = store.projects.findIndex((project) => project.id === projectId)

  if (projectIndex < 0) {
    return null
  }

  const archivedStatus: ProjectStatus = "已完成"
  const currentProject = store.projects[projectIndex]
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

  const detailIndex = store.projectDetails.findIndex((detail) => detail.projectId === projectId)
  const archivedDetail =
    detailIndex >= 0
      ? {
          ...store.projectDetails[detailIndex],
          blockingReason: "项目已归档，不再继续派发新任务。",
          nextStep: '如需恢复，可在后续版本补充"重新激活"能力。',
          currentFocus: "保留结果、审计与证据回溯。",
          currentStage: {
            ...store.projectDetails[detailIndex].currentStage,
            title: "报告与回归验证",
            summary: "项目已完成当前周期并被归档。",
            blocker: "归档后不再继续调度新动作。",
            owner: SINGLE_USER_LABEL,
            updatedAt: archivedProject.lastUpdated,
          },
          closureStatus: buildProjectClosureStatus({
            finalConclusionGenerated: store.projectDetails[detailIndex].finalConclusion !== null,
            lifecycle: "idle",
            pendingApprovals: 0,
            projectStatus: archivedProject.status,
            queuedTaskCount: 0,
            reportExported: store.projectDetails[detailIndex].closureStatus.reportExported,
            runningTaskCount: 0,
            waitingApprovalTaskCount: 0,
          }),
        }
      : buildProjectDetail(archivedProject)

  store.projects[projectIndex] = archivedProject

  if (detailIndex >= 0) {
    store.projectDetails[detailIndex] = archivedDetail
  } else {
    store.projectDetails.unshift(archivedDetail)
  }

  store.auditLogs.unshift(createAuditLog(`归档项目 ${archivedProject.name}`, archivedProject, "已记录"))
  writePrototypeStore(store)

  return { detail: archivedDetail, project: archivedProject }
}
