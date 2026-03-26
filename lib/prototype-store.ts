import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import {
  approvalPolicies,
  approvals,
  globalApprovalControl,
  auditLogs,
  defaultProjectFormPreset,
  getProjectDetailById,
  getProjectFormPreset,
  projects,
  scopeRules,
} from "@/lib/prototype-data"
import type {
  ApprovalControl,
  ApprovalRecord,
  LogRecord,
  PolicyRecord,
  ProjectDetailRecord,
  ProjectFormPreset,
  ProjectRecord,
} from "@/lib/prototype-types"

type PrototypeStore = {
  version: number
  auditLogs: LogRecord[]
  approvalPolicies: PolicyRecord[]
  approvals: ApprovalRecord[]
  globalApprovalControl: ApprovalControl
  projectDetails: ProjectDetailRecord[]
  projectFormPresets: Record<string, ProjectFormPreset>
  projects: ProjectRecord[]
  scopeRules: PolicyRecord[]
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

  const seededProjectFormPresets = Object.fromEntries(
    projects.map((project) => [project.id, getProjectFormPreset(project.id)]),
  )

  return {
    version: 2,
    auditLogs: cloneValue(auditLogs),
    approvalPolicies: cloneValue(approvalPolicies),
    approvals: cloneValue(approvals),
    globalApprovalControl: cloneValue(globalApprovalControl),
    projectDetails: cloneValue(seededProjectDetails),
    projectFormPresets: cloneValue(seededProjectFormPresets),
    projects: cloneValue(projects),
    scopeRules: cloneValue(scopeRules),
  }
}

function normalizeStore(store: Partial<PrototypeStore>): PrototypeStore {
  const seeded = buildSeedStore()

  return {
    version: Math.max(store.version ?? 1, seeded.version),
    auditLogs: Array.isArray(store.auditLogs) ? store.auditLogs : seeded.auditLogs,
    approvalPolicies: Array.isArray(store.approvalPolicies) ? store.approvalPolicies : seeded.approvalPolicies,
    approvals: Array.isArray(store.approvals) ? store.approvals : seeded.approvals,
    globalApprovalControl: store.globalApprovalControl ?? seeded.globalApprovalControl,
    projectDetails: Array.isArray(store.projectDetails) ? store.projectDetails : seeded.projectDetails,
    projectFormPresets: store.projectFormPresets ?? seeded.projectFormPresets,
    projects: Array.isArray(store.projects) ? store.projects : seeded.projects,
    scopeRules: Array.isArray(store.scopeRules) ? store.scopeRules : seeded.scopeRules,
  }
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
  const store = normalizeStore(rawStore)

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
