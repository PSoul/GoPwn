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
import { generateProjectId } from "@/lib/project-id"

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

function parseTags(tags: string) {
  return tags
    .split(/[\/,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function buildProjectId() {
  return generateProjectId()
}

function buildProjectCode(existingProjects: ProjectRecord[]) {
  return `PRJ-${formatDayStamp()}-${String(existingProjects.length + 1).padStart(3, "0")}`
}

function buildProjectFormPreset(input: ProjectMutationInput): ProjectFormPreset {
  return {
    ...input,
  }
}

function buildProjectSummary(input: ProjectMutationInput) {
  return `${input.targetSummary}。当前处于项目基线建立阶段，等待研究员继续补齐范围、审批与结果链路。`
}

function buildProjectRecord(input: ProjectMutationInput, existingProjects: ProjectRecord[]): ProjectRecord {
  const timestamp = formatTimestamp()

  return {
    id: buildProjectId(),
    code: buildProjectCode(existingProjects),
    name: input.name,
    seed: input.seed,
    targetType: input.targetType,
    targetSummary: input.targetSummary,
    owner: input.owner,
    priority: input.priority,
    stage: "授权与范围定义",
    status: "待处理",
    pendingApprovals: 0,
    openTasks: 1,
    assetCount: 0,
    evidenceCount: 0,
    createdAt: timestamp,
    lastUpdated: timestamp,
    lastActor: "项目创建",
    riskSummary: "尚未进入识别与验证，等待研究员确认范围和执行策略。",
    summary: buildProjectSummary(input),
    authorizationSummary: input.authorizationSummary,
    scopeSummary: input.scopeSummary,
    forbiddenActions: input.forbiddenActions,
    defaultConcurrency: input.defaultConcurrency,
    rateLimit: input.rateLimit,
    timeout: input.timeout,
    approvalMode: input.approvalMode,
    tags: parseTags(input.tags),
  }
}

function buildProjectDetail(project: ProjectRecord, preset: ProjectFormPreset): ProjectDetailRecord {
  return {
    projectId: project.id,
    target: project.targetSummary,
    blockingReason: "项目刚创建，尚未建立第一批识别与审批任务。",
    nextStep: "先确认授权说明、范围规则和种子目标，再进入持续信息收集。",
    reflowNotice: "新增资产或范围变化后，可从这里回流到范围判定与结果页继续沉淀。",
    currentFocus: "建立项目基线、补第一条任务和后续审批/证据链入口。",
    timeline: [
      { title: "授权与范围定义", state: "current", note: "项目已创建，等待复核授权与边界。" },
      { title: "种子目标接收", state: "watching", note: "等待研究员确认目标种子与摘要。" },
      { title: "持续信息收集", state: "watching", note: "待基线确认后进入被动信息收集。" },
    ],
    tasks: [
      {
        id: `task-${project.id}-001`,
        projectId: project.id,
        title: "确认种子目标与授权边界",
        status: "pending",
        reason: "项目新建后，需要先建立可执行边界。",
        priority: "P1",
        owner: project.owner,
        updatedAt: project.lastUpdated,
      },
    ],
    discoveredInfo: [
      {
        title: "项目基线已创建",
        detail: preset.deliveryNotes,
        meta: project.lastUpdated,
        tone: "info",
      },
    ],
    serviceSurface: [],
    fingerprints: [],
    entries: [],
    scheduler: [
      {
        title: "等待首批任务入列",
        detail: "在授权、范围与种子目标确认完成前，不自动生成高风险动作。",
        meta: "pending",
        tone: "warning",
      },
    ],
    activity: [
      {
        title: "项目创建完成",
        detail: "已建立基础信息、范围规则与执行策略，可继续进入详情页推进。",
        meta: project.lastUpdated,
        tone: "success",
      },
    ],
    resultMetrics: [
      { label: "已纳入域名", value: "0", note: "等待识别", tone: "neutral" },
      { label: "开放端口", value: "0", note: "等待识别", tone: "neutral" },
      { label: "漏洞线索", value: "0", note: "等待验证", tone: "neutral" },
      { label: "证据锚点", value: "0", note: "等待采样", tone: "neutral" },
    ],
    assetGroups: [
      {
        title: "域名 / Web 入口",
        description: "项目新建后，域名和 Web 入口将在这里沉淀。",
        count: "0 项",
        items: [],
      },
      {
        title: "IP / 端口 / 服务",
        description: "网络侧资产会在识别后进入这张结果表。",
        count: "0 项",
        items: [],
      },
    ],
    findings: [],
    currentStage: {
      title: "授权与范围定义",
      summary: "项目已建立，但仍处在执行基线确认阶段。",
      blocker: "尚未确认首批识别任务和审批策略是否需要微调。",
      owner: project.owner,
      updatedAt: project.lastUpdated,
    },
    approvalControl: {
      enabled: true,
      mode: project.approvalMode,
      autoApproveLowRisk: project.approvalMode.includes("低风险自动"),
      description: "项目新建后默认沿用表单里的审批模式，并等待后续任务接入。",
      note: "随着后续范围、结果和风险变化，可在项目级继续调整审批控制。",
    },
  }
}

function createAuditLog(summary: string, project: ProjectRecord, status = "已记录"): LogRecord {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    category: "项目管理",
    summary,
    projectName: project.name,
    actor: "平台账号",
    timestamp: formatTimestamp(),
    status,
  }
}

function mergeProjectRecord(project: ProjectRecord, patch: ProjectPatchInput): ProjectRecord {
  const nextName = patch.name ?? project.name
  const nextTargetSummary = patch.targetSummary ?? project.targetSummary

  return {
    ...project,
    name: nextName,
    seed: patch.seed ?? project.seed,
    targetType: patch.targetType ?? project.targetType,
    owner: patch.owner ?? project.owner,
    priority: patch.priority ?? project.priority,
    targetSummary: nextTargetSummary,
    authorizationSummary: patch.authorizationSummary ?? project.authorizationSummary,
    scopeSummary: patch.scopeSummary ?? project.scopeSummary,
    forbiddenActions: patch.forbiddenActions ?? project.forbiddenActions,
    defaultConcurrency: patch.defaultConcurrency ?? project.defaultConcurrency,
    rateLimit: patch.rateLimit ?? project.rateLimit,
    timeout: patch.timeout ?? project.timeout,
    approvalMode: patch.approvalMode ?? project.approvalMode,
    tags: patch.tags ? parseTags(patch.tags) : project.tags,
    summary: patch.deliveryNotes ?? buildProjectSummary({
      name: nextName,
      seed: patch.seed ?? project.seed,
      targetType: patch.targetType ?? project.targetType,
      owner: patch.owner ?? project.owner,
      priority: patch.priority ?? project.priority,
      targetSummary: nextTargetSummary,
      authorizationSummary: patch.authorizationSummary ?? project.authorizationSummary,
      scopeSummary: patch.scopeSummary ?? project.scopeSummary,
      forbiddenActions: patch.forbiddenActions ?? project.forbiddenActions,
      defaultConcurrency: patch.defaultConcurrency ?? project.defaultConcurrency,
      rateLimit: patch.rateLimit ?? project.rateLimit,
      timeout: patch.timeout ?? project.timeout,
      approvalMode: patch.approvalMode ?? project.approvalMode,
      tags: patch.tags ?? project.tags.join(" / "),
      deliveryNotes: patch.deliveryNotes ?? buildProjectSummary({
        name: project.name,
        seed: project.seed,
        targetType: project.targetType,
        owner: project.owner,
        priority: project.priority,
        targetSummary: project.targetSummary,
        authorizationSummary: project.authorizationSummary,
        scopeSummary: project.scopeSummary,
        forbiddenActions: project.forbiddenActions,
        defaultConcurrency: project.defaultConcurrency,
        rateLimit: project.rateLimit,
        timeout: project.timeout,
        approvalMode: project.approvalMode,
        tags: project.tags.join(" / "),
        deliveryNotes: project.summary,
      }),
    }),
    lastUpdated: formatTimestamp(),
    lastActor: "项目编辑",
  }
}

function mergeProjectFormPreset(preset: ProjectFormPreset, patch: ProjectPatchInput): ProjectFormPreset {
  return {
    ...preset,
    ...patch,
  }
}

function updateProjectDetail(detail: ProjectDetailRecord, project: ProjectRecord, preset: ProjectFormPreset): ProjectDetailRecord {
  return {
    ...detail,
    target: project.targetSummary,
    nextStep: "基线已更新，可继续在结果、流程和审批页推进。",
    currentFocus: "围绕最新目标摘要与策略设置继续推进项目结果沉淀。",
    discoveredInfo: detail.discoveredInfo.length
      ? [
          {
            ...detail.discoveredInfo[0],
            detail: preset.deliveryNotes,
            meta: project.lastUpdated,
          },
          ...detail.discoveredInfo.slice(1),
        ]
      : detail.discoveredInfo,
    currentStage: {
      ...detail.currentStage,
      owner: project.owner,
      updatedAt: project.lastUpdated,
    },
    approvalControl: {
      ...detail.approvalControl,
      mode: project.approvalMode,
      autoApproveLowRisk: project.approvalMode.includes("低风险自动"),
    },
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
    return readPrototypeStore().projectFormPresets[store.projects[0]?.id] ?? null
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
  const detail = buildProjectDetail(project, preset)

  store.projects.unshift(project)
  store.projectDetails.unshift(detail)
  store.projectFormPresets[project.id] = preset
  store.projectSchedulerControls[project.id] = {
    paused: false,
    note: "默认允许调度器处理 ready / retry / delayed 任务。",
    updatedAt: project.lastUpdated,
  }
  store.auditLogs.unshift(createAuditLog(`创建项目 ${project.name}` , project, "已完成"))
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
      ? updateProjectDetail(store.projectDetails[detailIndex], nextProject, nextPreset)
      : buildProjectDetail(nextProject, nextPreset)

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
    tags: currentProject.tags.includes("已归档") ? currentProject.tags : [...currentProject.tags, "已归档"],
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
            owner: archivedProject.owner,
            updatedAt: archivedProject.lastUpdated,
          },
        }
      : buildProjectDetail(archivedProject, store.projectFormPresets[projectId])

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
