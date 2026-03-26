import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import {
  auditLogs,
  defaultProjectFormPreset,
  getProjectDetailById,
  getProjectFormPreset,
  projects,
} from "@/lib/prototype-data"
import type { LogRecord, ProjectDetailRecord, ProjectFormPreset, ProjectRecord } from "@/lib/prototype-types"

type PrototypeStore = {
  version: number
  auditLogs: LogRecord[]
  projectDetails: ProjectDetailRecord[]
  projectFormPresets: Record<string, ProjectFormPreset>
  projects: ProjectRecord[]
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
    version: 1,
    auditLogs: cloneValue(auditLogs),
    projectDetails: cloneValue(seededProjectDetails),
    projectFormPresets: cloneValue(seededProjectFormPresets),
    projects: cloneValue(projects),
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
  return JSON.parse(readFileSync(getStorePath(), "utf8")) as PrototypeStore
}

export function writePrototypeStore(store: PrototypeStore) {
  ensureStoreFile()
  writeFileSync(getStorePath(), JSON.stringify(store, null, 2), "utf8")
}

export function getDefaultProjectFormPreset() {
  return cloneValue(defaultProjectFormPreset)
}
