import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import {
  approvalPolicies,
  approvals,
  assets,
  evidenceRecords,
  globalApprovalControl,
  auditLogs,
  defaultProjectFormPreset,
  getProjectDetailById,
  getProjectFormPreset,
  mcpRuns,
  mcpTools,
  projects,
  scopeRules,
  workLogs,
} from "@/lib/prototype-data"
import type {
  ApprovalControl,
  ApprovalRecord,
  AssetRecord,
  EvidenceRecord,
  LogRecord,
  McpRunRecord,
  McpSchedulerTaskRecord,
  McpToolRecord,
  OrchestratorPlanRecord,
  PolicyRecord,
  ProjectDetailRecord,
  ProjectFindingRecord,
  ProjectFormPreset,
  ProjectRecord,
} from "@/lib/prototype-types"
import { generateProjectId, isAsciiProjectId } from "@/lib/project-id"

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
  schedulerTasks: McpSchedulerTaskRecord[]
  mcpTools: McpToolRecord[]
  projectDetails: ProjectDetailRecord[]
  projectFindings: ProjectFindingRecord[]
  projectFormPresets: Record<string, ProjectFormPreset>
  projects: ProjectRecord[]
  scopeRules: PolicyRecord[]
  workLogs: LogRecord[]
}

const STORE_DIRECTORY = ".prototype-store"
const STORE_FILENAME = "prototype-store.json"

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function getStoreDirectory() {
  return process.env.PROTOTYPE_DATA_DIR ?? path.join(process.cwd(), STORE_DIRECTORY)
}

function getStorePath() {
  return path.join(getStoreDirectory(), STORE_FILENAME)
}

function buildSeedStore(): PrototypeStore {
  const seededProjectDetails = projects
    .map((project) => getProjectDetailById(project.id))
    .filter((detail): detail is ProjectDetailRecord => Boolean(detail))
  const seededProjectFindings = seededProjectDetails.flatMap((detail) => detail.findings)

  const seededProjectFormPresets = Object.fromEntries(
    projects.map((project) => [project.id, getProjectFormPreset(project.id)]),
  )

  return {
    version: 7,
    auditLogs: cloneValue(auditLogs),
    approvalPolicies: cloneValue(approvalPolicies),
    approvals: cloneValue(approvals),
    assets: cloneValue(assets),
    evidenceRecords: cloneValue(evidenceRecords),
    globalApprovalControl: cloneValue(globalApprovalControl),
    mcpRuns: cloneValue(mcpRuns),
    orchestratorPlans: {},
    schedulerTasks: [],
    mcpTools: cloneValue(mcpTools),
    projectDetails: cloneValue(seededProjectDetails),
    projectFindings: cloneValue(seededProjectFindings),
    projectFormPresets: cloneValue(seededProjectFormPresets),
    projects: cloneValue(projects),
    scopeRules: cloneValue(scopeRules),
    workLogs: cloneValue(workLogs),
  }
}

function normalizeStore(store: Partial<PrototypeStore>): PrototypeStore {
  const seeded = buildSeedStore()

  return {
    version: Math.max(store.version ?? 1, seeded.version),
    auditLogs: Array.isArray(store.auditLogs) ? store.auditLogs : seeded.auditLogs,
    approvalPolicies: Array.isArray(store.approvalPolicies) ? store.approvalPolicies : seeded.approvalPolicies,
    approvals: Array.isArray(store.approvals) ? store.approvals : seeded.approvals,
    assets: Array.isArray(store.assets) ? store.assets : seeded.assets,
    evidenceRecords: Array.isArray(store.evidenceRecords) ? store.evidenceRecords : seeded.evidenceRecords,
    globalApprovalControl: store.globalApprovalControl ?? seeded.globalApprovalControl,
    mcpRuns: Array.isArray(store.mcpRuns) ? store.mcpRuns : seeded.mcpRuns,
    orchestratorPlans: store.orchestratorPlans ?? seeded.orchestratorPlans,
    schedulerTasks: Array.isArray(store.schedulerTasks) ? store.schedulerTasks : seeded.schedulerTasks,
    mcpTools: Array.isArray(store.mcpTools) ? store.mcpTools : seeded.mcpTools,
    projectDetails: Array.isArray(store.projectDetails) ? store.projectDetails : seeded.projectDetails,
    projectFindings: Array.isArray(store.projectFindings) ? store.projectFindings : seeded.projectFindings,
    projectFormPresets: store.projectFormPresets ?? seeded.projectFormPresets,
    projects: Array.isArray(store.projects) ? store.projects : seeded.projects,
    scopeRules: Array.isArray(store.scopeRules) ? store.scopeRules : seeded.scopeRules,
    workLogs: Array.isArray(store.workLogs) ? store.workLogs : seeded.workLogs,
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

  const orchestratorPlans = Object.fromEntries(
    Object.entries(store.orchestratorPlans).map(([projectId, plan]) => [mapId(projectId), plan]),
  )

  const migratedStore = {
    ...store,
    projects,
    projectDetails,
    projectFormPresets,
    approvals,
    assets,
    evidenceRecords,
    mcpRuns,
    schedulerTasks,
    projectFindings,
    orchestratorPlans,
  }

  assertNoLegacyProjectIds(migratedStore, legacyIds)
  return migratedStore
}

function ensureStoreFile() {
  const storeDirectory = getStoreDirectory()
  const storePath = getStorePath()

  if (!existsSync(storeDirectory)) {
    mkdirSync(storeDirectory, { recursive: true })
  }

  if (!existsSync(storePath)) {
    writeFileSync(storePath, JSON.stringify(buildSeedStore(), null, 2), "utf8")
  }
}

export function readPrototypeStore(): PrototypeStore {
  ensureStoreFile()
  const rawStore = JSON.parse(readFileSync(getStorePath(), "utf8")) as Partial<PrototypeStore>
  const normalized = normalizeStore(rawStore)
  const store = migrateProjectIds(normalized)

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
