import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { defaultGlobalApprovalControl, defaultProjectFormPreset } from "@/lib/platform-config"
import { buildProjectClosureStatus } from "@/lib/project-closure-status"
import { generateProjectId, isAsciiProjectId } from "@/lib/project-id"
import { normalizeProjectSchedulerControl } from "@/lib/project-scheduler-lifecycle"
import { normalizeProjectTargets, SINGLE_USER_LABEL } from "@/lib/project-targets"
import type {
  ApprovalControl,
  ApprovalRecord,
  AssetRecord,
  EvidenceRecord,
  LlmProfileRecord,
  LogRecord,
  McpRunRecord,
  McpSchedulerTaskRecord,
  McpServerContractSummaryRecord,
  McpToolContractSummaryRecord,
  McpToolRecord,
  OrchestratorPlanRecord,
  OrchestratorRoundRecord,
  PolicyRecord,
  ProjectConclusionRecord,
  ProjectDetailRecord,
  ProjectFindingRecord,
  ProjectFormPreset,
  ProjectRecord,
  ProjectSchedulerControl,
  LlmCallLogRecord,
  UserRecord,
} from "@/lib/prototype-types"

export type PrototypeStore = {
  version: number
  auditLogs: LogRecord[]
  approvalPolicies: PolicyRecord[]
  approvals: ApprovalRecord[]
  assets: AssetRecord[]
  evidenceRecords: EvidenceRecord[]
  globalApprovalControl: ApprovalControl
  mcpRuns: McpRunRecord[]
  orchestratorPlans: Record<string, OrchestratorPlanRecord>
  orchestratorRounds: Record<string, OrchestratorRoundRecord[]>
  schedulerTasks: McpSchedulerTaskRecord[]
  mcpTools: McpToolRecord[]
  llmProfiles: LlmProfileRecord[]
  mcpServerContracts: McpServerContractSummaryRecord[]
  mcpToolContracts: McpToolContractSummaryRecord[]
  projectConclusions: ProjectConclusionRecord[]
  projectDetails: ProjectDetailRecord[]
  projectFindings: ProjectFindingRecord[]
  projectFormPresets: Record<string, ProjectFormPreset>
  projectSchedulerControls: Record<string, ProjectSchedulerControl>
  projects: ProjectRecord[]
  scopeRules: PolicyRecord[]
  users: UserRecord[]
  workLogs: LogRecord[]
  llmCallLogs: LlmCallLogRecord[]
}

const STORE_DIRECTORY = ".prototype-store"
const STORE_FILENAME = "prototype-store.json"
const SEEDED_PROJECT_IDS = new Set(["proj-huayao", "proj-xingtu", "proj-yunlan"])
const SEEDED_PROJECT_NAMES = new Set(["华曜科技匿名外网面梳理", "星图教育开放资产评估", "云岚医械公网暴露面验证"])

export const DEFAULT_LLM_PROFILES: LlmProfileRecord[] = [
  {
    id: "orchestrator",
    provider: "openai-compatible",
    label: "Default Orchestrator",
    apiKey: "",
    baseUrl: "",
    model: "",
    timeoutMs: 120000,
    temperature: 0.2,
    contextWindowSize: 65536,
    enabled: false,
  },
  {
    id: "reviewer",
    provider: "openai-compatible",
    label: "Default Reviewer",
    apiKey: "",
    baseUrl: "",
    model: "",
    timeoutMs: 120000,
    temperature: 0.1,
    contextWindowSize: 65536,
    enabled: false,
  },
  {
    id: "analyzer",
    provider: "openai-compatible",
    label: "Default Analyzer",
    apiKey: "",
    baseUrl: "",
    model: "",
    timeoutMs: 120000,
    temperature: 0,
    contextWindowSize: 65536,
    enabled: false,
  },
]

/**
 * Production LLM profiles - used to auto-seed when all store profiles are unconfigured.
 * Applied once during store normalization (not in test environments).
 */
export const PRODUCTION_LLM_PROFILES: LlmProfileRecord[] = [
  {
    id: "orchestrator",
    provider: "openai-compatible",
    label: "Default Orchestrator",
    apiKey: "sk-pryesvbybgrplivmlsrfsbluaoyctebqchsqjjfhbnjtkedc",
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "Pro/deepseek-ai/DeepSeek-V3.2",
    timeoutMs: 120000,
    temperature: 0.2,
    contextWindowSize: 65536,
    enabled: true,
  },
  {
    id: "reviewer",
    provider: "openai-compatible",
    label: "Default Reviewer",
    apiKey: "sk-pryesvbybgrplivmlsrfsbluaoyctebqchsqjjfhbnjtkedc",
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "Pro/deepseek-ai/DeepSeek-V3.2",
    timeoutMs: 120000,
    temperature: 0.1,
    contextWindowSize: 65536,
    enabled: true,
  },
  {
    id: "analyzer",
    provider: "openai-compatible",
    label: "Default Analyzer",
    apiKey: "sk-pryesvbybgrplivmlsrfsbluaoyctebqchsqjjfhbnjtkedc",
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "Pro/deepseek-ai/DeepSeek-V3.2",
    timeoutMs: 60000,
    temperature: 0,
    contextWindowSize: 65536,
    enabled: true,
  },
]

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function getStoreDirectory() {
  return process.env.PROTOTYPE_DATA_DIR ?? path.join(process.cwd(), STORE_DIRECTORY)
}

function getStorePath() {
  return path.join(getStoreDirectory(), STORE_FILENAME)
}

function buildInitialStore(): PrototypeStore {
  return {
    version: 13,
    auditLogs: [],
    approvalPolicies: [],
    approvals: [],
    assets: [],
    evidenceRecords: [],
    globalApprovalControl: cloneValue(defaultGlobalApprovalControl),
    mcpRuns: [],
    orchestratorPlans: {},
    orchestratorRounds: {},
    schedulerTasks: [],
    mcpTools: [],
    llmProfiles: cloneValue(DEFAULT_LLM_PROFILES),
    mcpServerContracts: [],
    mcpToolContracts: [],
    projectConclusions: [],
    projectDetails: [],
    projectFindings: [],
    projectFormPresets: {},
    projectSchedulerControls: {},
    projects: [],
    scopeRules: [],
    users: [],
    workLogs: [],
    llmCallLogs: [],
  }
}

function stripLegacyProjectFields(project: ProjectRecord): ProjectRecord {
  const normalizedProject = { ...project } as ProjectRecord & Record<string, unknown>

  delete normalizedProject.seed
  delete normalizedProject.targetType
  delete normalizedProject.targetSummary
  delete normalizedProject.owner
  delete normalizedProject.priority
  delete normalizedProject.authorizationSummary
  delete normalizedProject.scopeSummary
  delete normalizedProject.forbiddenActions
  delete normalizedProject.defaultConcurrency
  delete normalizedProject.rateLimit
  delete normalizedProject.timeout
  delete normalizedProject.approvalMode
  delete normalizedProject.tags

  return normalizedProject
}

function migrateSimplifiedProjectModel(store: PrototypeStore): PrototypeStore {
  const projects = store.projects.map((project) => {
    if (project.targetInput && Array.isArray(project.targets) && typeof project.description === "string") {
      return stripLegacyProjectFields(project)
    }

    const targetInput =
      typeof project.targetInput === "string" && project.targetInput.trim().length > 0
        ? project.targetInput
        : typeof project.seed === "string" && project.seed.trim().length > 0
        ? project.seed
        : typeof project.targetSummary === "string"
        ? project.targetSummary
        : ""
    const targets =
      Array.isArray(project.targets) && project.targets.length > 0 ? project.targets : normalizeProjectTargets(targetInput)
    const description =
      typeof project.description === "string" && project.description.trim().length > 0
        ? project.description
        : typeof project.targetSummary === "string" && project.targetSummary.trim().length > 0
        ? project.targetSummary
        : typeof project.summary === "string"
        ? project.summary
        : ""

    return stripLegacyProjectFields({
      ...project,
      targetInput,
      targets,
      description,
    })
  })

  const projectFormPresets = Object.fromEntries(
    Object.entries(store.projectFormPresets).map(([projectId, preset]) => {
      const project = projects.find((item) => item.id === projectId)
      const targetInput =
        typeof preset.targetInput === "string" && preset.targetInput.trim().length > 0
          ? preset.targetInput
          : typeof preset.seed === "string" && preset.seed.trim().length > 0
          ? preset.seed
          : project?.targetInput ?? ""
      const description =
        typeof preset.description === "string" && preset.description.trim().length > 0
          ? preset.description
          : typeof preset.targetSummary === "string" && preset.targetSummary.trim().length > 0
          ? preset.targetSummary
          : project?.description ?? ""

      return [
        projectId,
        {
          name: preset.name ?? project?.name ?? "",
          targetInput,
          description,
        },
      ]
    }),
  )

  const projectDetails = store.projectDetails.map((detail) => {
    const project = projects.find((item) => item.id === detail.projectId)

    if (!project) {
      return detail
    }

    const lifecycle = store.projectSchedulerControls[project.id]?.lifecycle ?? (project.status === "待启动" ? "idle" : "running")
    const projectRuns = store.mcpRuns.filter((run) => run.projectId === project.id)
    const projectApprovals = store.approvals.filter((approval) => approval.projectId === project.id)
    const projectSchedulerTasks = store.schedulerTasks.filter((task) => task.projectId === project.id)

    return {
      ...detail,
      target: detail.target || project.targetInput,
      discoveredInfo:
        detail.discoveredInfo.length > 0
          ? detail.discoveredInfo
          : [
              {
                title: "项目说明",
                detail: project.description,
                meta: project.lastUpdated,
                tone: "info" as const,
              },
            ],
      currentStage: {
        ...detail.currentStage,
        owner: detail.currentStage.owner || SINGLE_USER_LABEL,
      },
      closureStatus:
        detail.closureStatus ??
        buildProjectClosureStatus({
          finalConclusionGenerated: detail.finalConclusion !== null || store.projectConclusions.some((item) => item.projectId === project.id),
          lifecycle,
          pendingApprovals: projectApprovals.filter((approval) => approval.status === "待处理").length,
          projectStatus: project.status,
          queuedTaskCount: projectSchedulerTasks.filter((task) => ["ready", "retry_scheduled", "delayed"].includes(task.status)).length,
          reportExported: projectRuns.some((run) => run.toolName === "report-exporter" && run.status === "已执行"),
          runningTaskCount: projectSchedulerTasks.filter((task) => task.status === "running").length,
          waitingApprovalTaskCount: projectSchedulerTasks.filter((task) => task.status === "waiting_approval").length,
        }),
      finalConclusion: detail.finalConclusion ?? null,
    }
  })

  return {
    ...store,
    version: Math.max(store.version, 10),
    projects,
    projectDetails,
    projectFormPresets,
  }
}

function normalizeStore(store: Partial<PrototypeStore>): PrototypeStore {
  const initial = buildInitialStore()

  return {
    version: Math.max(store.version ?? 1, initial.version),
    auditLogs: Array.isArray(store.auditLogs) ? store.auditLogs : initial.auditLogs,
    approvalPolicies: Array.isArray(store.approvalPolicies) ? store.approvalPolicies : initial.approvalPolicies,
    approvals: Array.isArray(store.approvals) ? store.approvals : initial.approvals,
    assets: Array.isArray(store.assets) ? store.assets : initial.assets,
    evidenceRecords: Array.isArray(store.evidenceRecords) ? store.evidenceRecords : initial.evidenceRecords,
    globalApprovalControl: store.globalApprovalControl ?? initial.globalApprovalControl,
    mcpRuns: Array.isArray(store.mcpRuns) ? store.mcpRuns : initial.mcpRuns,
    orchestratorPlans: store.orchestratorPlans ?? initial.orchestratorPlans,
    orchestratorRounds: store.orchestratorRounds ?? initial.orchestratorRounds,
    schedulerTasks: Array.isArray(store.schedulerTasks) ? store.schedulerTasks : initial.schedulerTasks,
    mcpTools: Array.isArray(store.mcpTools) ? store.mcpTools : initial.mcpTools,
    llmProfiles: Array.isArray(store.llmProfiles) ? store.llmProfiles : initial.llmProfiles,
    mcpServerContracts: Array.isArray(store.mcpServerContracts) ? store.mcpServerContracts : initial.mcpServerContracts,
    mcpToolContracts: Array.isArray(store.mcpToolContracts) ? store.mcpToolContracts : initial.mcpToolContracts,
    projectConclusions: Array.isArray(store.projectConclusions) ? store.projectConclusions : initial.projectConclusions,
    projectDetails: Array.isArray(store.projectDetails) ? store.projectDetails : initial.projectDetails,
    projectFindings: Array.isArray(store.projectFindings) ? store.projectFindings : initial.projectFindings,
    projectFormPresets: store.projectFormPresets ?? initial.projectFormPresets,
    projectSchedulerControls: store.projectSchedulerControls ?? initial.projectSchedulerControls,
    projects: Array.isArray(store.projects) ? store.projects : initial.projects,
    scopeRules: Array.isArray(store.scopeRules) ? store.scopeRules : initial.scopeRules,
    users: Array.isArray(store.users) ? store.users : initial.users,
    workLogs: Array.isArray(store.workLogs) ? store.workLogs : initial.workLogs,
    llmCallLogs: Array.isArray(store.llmCallLogs) ? store.llmCallLogs : initial.llmCallLogs,
  }
}

function parseDayStamp(value?: string) {
  if (!value) {
    return null
  }

  const match = value.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!match) {
    return null
  }

  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

function buildProjectIdMap(projects: ProjectRecord[]) {
  const usedIds = new Set(projects.map((project) => project.id).filter((id) => isAsciiProjectId(id)))
  const idMap = new Map<string, string>()

  for (const project of projects) {
    if (isAsciiProjectId(project.id)) {
      continue
    }

    const baseDate = parseDayStamp(project.createdAt) ?? new Date()
    const seed = [project.id, project.name, project.createdAt].join(":")
    let nextId = generateProjectId(baseDate, seed)

    while (usedIds.has(nextId)) {
      nextId = generateProjectId(baseDate, `${seed}:${usedIds.size}`)
    }

    idMap.set(project.id, nextId)
    usedIds.add(nextId)
  }

  return idMap
}

function assertNoLegacyProjectIds(value: unknown, legacyIds: Set<string>) {
  if (typeof value === "string") {
    if (legacyIds.has(value)) {
      throw new Error(`Legacy project id remained after migration: ${value}`)
    }

    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => assertNoLegacyProjectIds(entry, legacyIds))
    return
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((entry) => assertNoLegacyProjectIds(entry, legacyIds))
  }
}

function migrateProjectIds(store: PrototypeStore): PrototypeStore {
  const idMap = buildProjectIdMap(store.projects)
  const legacyIds = new Set(idMap.keys())

  if (idMap.size === 0) {
    assertNoLegacyProjectIds(store, legacyIds)
    return store
  }

  const mapId = (value: string) => idMap.get(value) ?? value

  const projects = store.projects.map((project) =>
    idMap.has(project.id)
      ? {
          ...project,
          id: mapId(project.id),
        }
      : project,
  )

  const projectDetails = store.projectDetails.map((detail) => {
    const nextProjectId = mapId(detail.projectId)
    const nextTasks = detail.tasks.map((task) =>
      task.projectId === nextProjectId || !idMap.has(task.projectId)
        ? task
        : {
            ...task,
            projectId: mapId(task.projectId),
          },
    )
    const nextFindings = detail.findings.map((finding) =>
      finding.projectId === nextProjectId || !idMap.has(finding.projectId)
        ? finding
        : {
            ...finding,
            projectId: mapId(finding.projectId),
          },
    )

    if (nextProjectId === detail.projectId && nextTasks === detail.tasks && nextFindings === detail.findings) {
      return detail
    }

    return {
      ...detail,
      projectId: nextProjectId,
      tasks: nextTasks,
      findings: nextFindings,
    }
  })

  const projectFormPresets = Object.fromEntries(
    Object.entries(store.projectFormPresets).map(([projectId, preset]) => [mapId(projectId), preset]),
  )
  const projectSchedulerControls = Object.fromEntries(
    Object.entries(store.projectSchedulerControls).map(([projectId, control]) => [mapId(projectId), control]),
  )

  const approvals = store.approvals.map((approval) =>
    idMap.has(approval.projectId)
      ? {
          ...approval,
          projectId: mapId(approval.projectId),
        }
      : approval,
  )

  const assets = store.assets.map((asset) =>
    idMap.has(asset.projectId)
      ? {
          ...asset,
          projectId: mapId(asset.projectId),
        }
      : asset,
  )

  const evidenceRecords = store.evidenceRecords.map((record) =>
    idMap.has(record.projectId)
      ? {
          ...record,
          projectId: mapId(record.projectId),
        }
      : record,
  )

  const mcpRuns = store.mcpRuns.map((run) =>
    idMap.has(run.projectId)
      ? {
          ...run,
          projectId: mapId(run.projectId),
        }
      : run,
  )

  const schedulerTasks = store.schedulerTasks.map((task) =>
    idMap.has(task.projectId)
      ? {
          ...task,
          projectId: mapId(task.projectId),
        }
      : task,
  )

  const projectFindings = store.projectFindings.map((finding) =>
    idMap.has(finding.projectId)
      ? {
          ...finding,
          projectId: mapId(finding.projectId),
        }
      : finding,
  )

  const projectConclusions = store.projectConclusions.map((conclusion) =>
    idMap.has(conclusion.projectId)
      ? {
          ...conclusion,
          projectId: mapId(conclusion.projectId),
        }
      : conclusion,
  )

  const orchestratorPlans = Object.fromEntries(
    Object.entries(store.orchestratorPlans).map(([projectId, plan]) => [mapId(projectId), plan]),
  )

  const mcpServerContracts = store.mcpServerContracts.map((contract) =>
    contract.projectId && idMap.has(contract.projectId)
      ? {
          ...contract,
          projectId: mapId(contract.projectId),
        }
      : contract,
  )

  const mcpToolContracts = store.mcpToolContracts.map((contract) =>
    contract.projectId && idMap.has(contract.projectId)
      ? {
          ...contract,
          projectId: mapId(contract.projectId),
        }
      : contract,
  )

  const migratedStore = {
    ...store,
    projects,
    projectDetails,
    projectFormPresets,
    projectSchedulerControls,
    approvals,
    assets,
    evidenceRecords,
    mcpRuns,
    schedulerTasks,
    projectConclusions,
    projectFindings,
    orchestratorPlans,
    mcpServerContracts,
    mcpToolContracts,
  }

  assertNoLegacyProjectIds(migratedStore, legacyIds)
  return migratedStore
}

function purgeSeededBusinessRecords(store: PrototypeStore): PrototypeStore {
  const seededIds = new Set(
    store.projects
      .filter((project) => SEEDED_PROJECT_IDS.has(project.id) || SEEDED_PROJECT_NAMES.has(project.name))
      .map((project) => project.id),
  )

  if (seededIds.size === 0) {
    return store
  }

  const isSeededProjectId = (projectId?: string) => Boolean(projectId && seededIds.has(projectId))
  const isSeededProjectName = (projectName?: string) => Boolean(projectName && SEEDED_PROJECT_NAMES.has(projectName))

  return {
    ...store,
    projects: store.projects.filter((project) => !seededIds.has(project.id)),
    projectDetails: store.projectDetails.filter((detail) => !seededIds.has(detail.projectId)),
    projectConclusions: store.projectConclusions.filter((conclusion) => !seededIds.has(conclusion.projectId)),
    projectFindings: store.projectFindings.filter((finding) => !seededIds.has(finding.projectId)),
    approvals: store.approvals.filter((approval) => !seededIds.has(approval.projectId)),
    assets: store.assets.filter((asset) => !seededIds.has(asset.projectId)),
    evidenceRecords: store.evidenceRecords.filter((record) => !seededIds.has(record.projectId)),
    mcpRuns: store.mcpRuns.filter((run) => !seededIds.has(run.projectId)),
    schedulerTasks: store.schedulerTasks.filter((task) => !seededIds.has(task.projectId)),
    workLogs: store.workLogs.filter((log) => !isSeededProjectName(log.projectName)),
    auditLogs: store.auditLogs.filter((log) => !isSeededProjectName(log.projectName)),
    projectFormPresets: Object.fromEntries(
      Object.entries(store.projectFormPresets).filter(([projectId]) => !seededIds.has(projectId)),
    ),
    projectSchedulerControls: Object.fromEntries(
      Object.entries(store.projectSchedulerControls).filter(([projectId]) => !seededIds.has(projectId)),
    ),
    orchestratorPlans: Object.fromEntries(
      Object.entries(store.orchestratorPlans).filter(([projectId]) => !seededIds.has(projectId)),
    ),
    mcpServerContracts: store.mcpServerContracts.filter((contract) => !isSeededProjectId(contract.projectId)),
    mcpToolContracts: store.mcpToolContracts.filter((contract) => !isSeededProjectId(contract.projectId)),
  }
}

function ensureStoreFile() {
  const storeDirectory = getStoreDirectory()
  const storePath = getStorePath()

  if (!existsSync(storeDirectory)) {
    mkdirSync(storeDirectory, { recursive: true })
  }

  if (!existsSync(storePath)) {
    writeFileSync(storePath, JSON.stringify(buildInitialStore(), null, 2), "utf8")
  }
}

function seedProductionLlmProfiles(store: PrototypeStore): PrototypeStore {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return store
  }

  const allEmpty = store.llmProfiles.every((p) => !p.apiKey && !p.baseUrl && !p.model)
  if (!allEmpty) {
    return store
  }

  return {
    ...store,
    llmProfiles: PRODUCTION_LLM_PROFILES.map((prod) => {
      const existing = store.llmProfiles.find((p) => p.id === prod.id)
      return existing ? { ...existing, ...prod } : prod
    }),
  }
}

function ensureProjectSchedulerControls(store: PrototypeStore) {
  const nextControls = { ...store.projectSchedulerControls }
  let changed = false

  for (const project of store.projects) {
    const normalizedControl = normalizeProjectSchedulerControl({
      control: nextControls[project.id],
      projectStatus: project.status,
      updatedAt: project.lastUpdated,
    })

    if (JSON.stringify(normalizedControl) !== JSON.stringify(nextControls[project.id])) {
      nextControls[project.id] = normalizedControl
      changed = true
    }
  }

  if (!changed) {
    return store
  }

  return {
    ...store,
    projectSchedulerControls: nextControls,
  }
}

export function readPrototypeStore(): PrototypeStore {
  ensureStoreFile()
  const rawStore = JSON.parse(readFileSync(getStorePath(), "utf8")) as Partial<PrototypeStore>
  const normalized = normalizeStore(rawStore)
  const store = seedProductionLlmProfiles(ensureProjectSchedulerControls(
    migrateSimplifiedProjectModel(purgeSeededBusinessRecords(migrateProjectIds(normalized))),
  ))

  if (JSON.stringify(rawStore) !== JSON.stringify(store)) {
    writePrototypeStore(store)
  }

  return store
}

export function writePrototypeStore(store: PrototypeStore) {
  ensureStoreFile()
  writeFileSync(getStorePath(), JSON.stringify(store, null, 2), "utf8")
}

export function getDefaultProjectFormPreset() {
  return cloneValue(defaultProjectFormPreset)
}
