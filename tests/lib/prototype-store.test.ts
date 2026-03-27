import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import { createStoredProjectFixture } from "@/tests/helpers/project-fixtures"

const PROJECT_ID_PATTERN = /^proj-\d{8}-[a-f0-9]{8}$/

describe("prototype store project id migration", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-store-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
  })

  afterEach(() => {
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("rewrites legacy non-ascii ids across related records", () => {
    const legacyId = "proj-北栖"
    const created = createStoredProjectFixture()
    const store = readPrototypeStore()
    const baseProject = created.project
    const baseDetail = created.detail

    const legacyProject = {
      ...baseProject,
      id: legacyId,
      name: "Legacy 项目",
    }

    const legacyDetail = {
      ...baseDetail,
      projectId: legacyId,
      tasks: baseDetail.tasks.map((task) => ({
        ...task,
        projectId: legacyId,
      })),
      findings: baseDetail.findings.map((finding) => ({
        ...finding,
        projectId: legacyId,
      })),
    }

    const legacyPreset = store.projectFormPresets[baseProject.id]
    const legacyApproval = store.approvals[0]
      ? {
          ...store.approvals[0],
          id: "approval-legacy",
          projectId: legacyId,
          projectName: legacyProject.name,
        }
      : null
    const legacyAsset = store.assets[0]
      ? {
          ...store.assets[0],
          id: "asset-legacy",
          projectId: legacyId,
          projectName: legacyProject.name,
        }
      : null
    const legacyEvidence = store.evidenceRecords[0]
      ? {
          ...store.evidenceRecords[0],
          id: "evidence-legacy",
          projectId: legacyId,
          projectName: legacyProject.name,
        }
      : null
    const legacyRun = store.mcpRuns[0]
      ? {
          ...store.mcpRuns[0],
          id: "mcp-run-legacy",
          projectId: legacyId,
          projectName: legacyProject.name,
        }
      : null
    const legacyFinding = store.projectFindings[0]
      ? {
          ...store.projectFindings[0],
          id: "finding-legacy",
          projectId: legacyId,
        }
      : null

    const legacyPlan = {
      generatedAt: "2026-03-27 09:00",
      provider: "local",
      summary: "legacy plan",
      items: [],
    }

    const legacyStore = {
      ...store,
      projects: [legacyProject],
      projectDetails: [legacyDetail],
      projectFormPresets: {
        [legacyId]: legacyPreset,
      },
      approvals: legacyApproval ? [legacyApproval] : [],
      assets: legacyAsset ? [legacyAsset] : [],
      evidenceRecords: legacyEvidence ? [legacyEvidence] : [],
      mcpRuns: legacyRun ? [legacyRun] : [],
      schedulerTasks: [],
      projectFindings: legacyFinding ? [legacyFinding] : [],
      orchestratorPlans: {
        [legacyId]: legacyPlan,
      },
    }

    writePrototypeStore(legacyStore)

    const migrated = readPrototypeStore()
    const migratedProject = migrated.projects.find((project) => project.name === legacyProject.name)

    expect(migratedProject).toBeTruthy()
    expect(migratedProject?.id).toMatch(PROJECT_ID_PATTERN)
    expect(migratedProject?.id).not.toBe(legacyId)

    const nextProjectId = migratedProject?.id ?? ""
    const migratedDetail = migrated.projectDetails.find((detail) => detail.projectId === nextProjectId)

    expect(migratedDetail).toBeTruthy()
    expect(migratedDetail?.tasks.every((task) => task.projectId === nextProjectId)).toBe(true)
    expect(migratedDetail?.findings.every((finding) => finding.projectId === nextProjectId)).toBe(true)
    expect(migrated.projectFormPresets[nextProjectId]).toBeTruthy()
    expect(migrated.projectFormPresets[legacyId]).toBeUndefined()
    expect(Object.keys(migrated.orchestratorPlans)).not.toContain(legacyId)
    expect(Object.keys(migrated.orchestratorPlans)).toContain(nextProjectId)

    if (legacyApproval) {
      expect(migrated.approvals.find((approval) => approval.id === "approval-legacy")?.projectId).toBe(nextProjectId)
    }

    if (legacyAsset) {
      expect(migrated.assets.find((asset) => asset.id === "asset-legacy")?.projectId).toBe(nextProjectId)
    }

    if (legacyEvidence) {
      expect(migrated.evidenceRecords.find((record) => record.id === "evidence-legacy")?.projectId).toBe(nextProjectId)
    }

    if (legacyRun) {
      expect(migrated.mcpRuns.find((run) => run.id === "mcp-run-legacy")?.projectId).toBe(nextProjectId)
    }

    if (legacyFinding) {
      expect(migrated.projectFindings.find((finding) => finding.id === "finding-legacy")?.projectId).toBe(nextProjectId)
    }
  })
})
