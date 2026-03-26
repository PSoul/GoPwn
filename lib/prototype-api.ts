import {
  getProjectApprovals,
  getProjectAssetGroup,
  getProjectAssets,
  getProjectById,
  getProjectDetailById,
  getProjectEvidence,
  projects,
  settingsSections,
  systemStatusCards,
} from "@/lib/prototype-data"
import type {
  ProjectCollectionPayload,
  ProjectContextPayload,
  ProjectFindingsPayload,
  ProjectFlowPayload,
  ProjectInventoryPayload,
  ProjectOperationsPayload,
  ProjectOverviewPayload,
  SettingsSectionsPayload,
  SystemStatusPayload,
} from "@/lib/prototype-types"

function getProjectBase(projectId: string) {
  const project = getProjectById(projectId)
  const detail = getProjectDetailById(projectId)

  if (!project || !detail) {
    return null
  }

  return { project, detail }
}

export function listProjectsPayload(): ProjectCollectionPayload {
  return {
    items: projects,
    total: projects.length,
  }
}

export function getProjectOverviewPayload(projectId: string): ProjectOverviewPayload | null {
  return getProjectBase(projectId)
}

export function getProjectFlowPayload(projectId: string): ProjectFlowPayload | null {
  return getProjectBase(projectId)
}

export function getProjectOperationsPayload(projectId: string): ProjectOperationsPayload | null {
  const base = getProjectBase(projectId)

  if (!base) {
    return null
  }

  return {
    ...base,
    approvals: getProjectApprovals(projectId),
  }
}

export function getProjectContextPayload(projectId: string): ProjectContextPayload | null {
  const base = getProjectBase(projectId)

  if (!base) {
    return null
  }

  return {
    ...base,
    approvals: getProjectApprovals(projectId),
    assets: getProjectAssets(projectId),
    evidence: getProjectEvidence(projectId),
  }
}

export function getProjectInventoryPayload(
  projectId: string,
  groupTitle: string,
): ProjectInventoryPayload | null {
  const project = getProjectById(projectId)
  const group = getProjectAssetGroup(projectId, groupTitle)

  if (!project || !group) {
    return null
  }

  return {
    project,
    group,
  }
}

export function getProjectFindingsPayload(projectId: string): ProjectFindingsPayload | null {
  const base = getProjectBase(projectId)

  if (!base) {
    return null
  }

  return {
    project: base.project,
    findings: base.detail.findings,
  }
}

export function getSettingsSectionsPayload(): SettingsSectionsPayload {
  return {
    items: settingsSections,
    total: settingsSections.length,
  }
}

export function getSystemStatusPayload(): SystemStatusPayload {
  return {
    items: systemStatusCards,
    total: systemStatusCards.length,
  }
}
