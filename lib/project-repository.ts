import { defaultGlobalApprovalControl } from "@/lib/platform-config"
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

export function listStoredProjects() {
  return readPrototypeStore().projects
}

export function getStoredProjectById(projectId: string) {
  return readPrototypeStore().projects.find((project) => project.id === projectId) ?? null
}

export function getStoredProjectDetailById(projectId: string) {
  return readPrototypeStore().projectDetails.find((detail) => detail.projectId === projectId) ?? null
}

export function getStoredProjectFormPreset(projectId?: string) {
  const store = readPrototypeStore()

  if (!projectId) {
    return store.projectFormPresets[store.projects[0]?.id] ?? null
  }

  return store.projectFormPresets[projectId] ?? null
}

export function listStoredAuditLogs() {
  return readPrototypeStore().auditLogs
}

export function createStoredProject(input: ProjectMutationInput) {
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

export function updateStoredProject(projectId: string, patch: ProjectPatchInput) {
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

export function archiveStoredProject(projectId: string) {
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
          nextStep: "如需恢复，可在后续版本补充“重新激活”能力。",
          currentFocus: "保留结果、审计与证据回溯。",
          currentStage: {
            ...store.projectDetails[detailIndex].currentStage,
            title: "报告与回归验证",
            summary: "项目已完成当前周期并被归档。",
            blocker: "归档后不再继续调度新动作。",
            owner: SINGLE_USER_LABEL,
            updatedAt: archivedProject.lastUpdated,
          },
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
