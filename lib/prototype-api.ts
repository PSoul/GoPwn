import {
  dashboardMetrics,
  assets,
  dashboardPriorities,
  evidenceRecords,
  getAssetById,
  getProjectAssets,
  getEvidenceById,
  getProjectEvidence,
  mcpTools,
  projectTasks,
  settingsSections,
  systemControlOverview,
  systemStatusCards,
} from "@/lib/prototype-data"
import {
  getStoredGlobalApprovalControl,
  listStoredApprovalPolicies,
  listStoredApprovals,
  listStoredProjectApprovals,
  listStoredScopeRules,
  updateStoredApprovalDecision,
  updateStoredGlobalApprovalControl,
  updateStoredProjectApprovalControl,
} from "@/lib/approval-repository"
import {
  archiveStoredProject,
  createStoredProject,
  getStoredProjectById,
  getStoredProjectDetailById,
  getStoredProjectFormPreset,
  listStoredAuditLogs,
  listStoredProjects,
  updateStoredProject,
} from "@/lib/project-repository"
import { getDefaultProjectFormPreset } from "@/lib/prototype-store"
import type {
  ApprovalControlPatch,
  ApprovalCollectionPayload,
  ApprovalDecisionInput,
  ApprovalPolicyPayload,
  AssetCollectionPayload,
  AssetDetailPayload,
  DashboardPayload,
  EvidenceCollectionPayload,
  EvidenceDetailPayload,
  LogCollectionPayload,
  ProjectCollectionPayload,
  ProjectContextPayload,
  ProjectFindingsPayload,
  ProjectFlowPayload,
  ProjectFormPreset,
  ProjectInventoryPayload,
  ProjectMutationInput,
  ProjectOperationsPayload,
  ProjectOverviewPayload,
  ProjectPatchInput,
  ProjectRecord,
  SettingsSectionsPayload,
  SystemStatusPayload,
} from "@/lib/prototype-types"

function buildDashboardMetrics(projects: ProjectRecord[], approvalTotal: number) {
  return dashboardMetrics.map((metric) => {
    if (metric.label === "项目总数") {
      return {
        ...metric,
        value: String(projects.length),
      }
    }

    if (metric.label === "待审批动作") {
      return {
        ...metric,
        value: String(approvalTotal),
        delta: `${projects.filter((project) => project.pendingApprovals > 0).length} 个项目受影响`,
      }
    }

    return metric
  })
}

function getProjectBase(projectId: string) {
  const project = getStoredProjectById(projectId)
  const detail = getStoredProjectDetailById(projectId)

  if (!project || !detail) {
    return null
  }

  return { project, detail }
}

export function listProjectsPayload(): ProjectCollectionPayload {
  const projects = listStoredProjects()

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
    approvals: listStoredProjectApprovals(projectId),
  }
}

export function getProjectContextPayload(projectId: string): ProjectContextPayload | null {
  const base = getProjectBase(projectId)

  if (!base) {
    return null
  }

  return {
    ...base,
    approvals: listStoredProjectApprovals(projectId),
    assets: getProjectAssets(projectId),
    evidence: getProjectEvidence(projectId),
  }
}

export function getProjectInventoryPayload(
  projectId: string,
  groupTitle: string,
): ProjectInventoryPayload | null {
  const project = getStoredProjectById(projectId)
  const detail = getStoredProjectDetailById(projectId)
  const group = detail?.assetGroups.find((item) => item.title === groupTitle)

  if (!project || !group || !detail) {
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
  const auditTotal = listStoredAuditLogs().length
  const approvalControl = getStoredGlobalApprovalControl()

  return {
    items: settingsSections.map((section) => {
      if (section.href === "/settings/approval-policy") {
        return {
          ...section,
          metric: approvalControl.enabled ? "高风险审批开启" : "审批临时关闭",
        }
      }

      if (section.href === "/settings/audit-logs") {
        return {
          ...section,
          metric: `${auditTotal} 条审计记录`,
        }
      }

      return section
    }),
    total: settingsSections.length,
  }
}

export function getSystemStatusPayload(): SystemStatusPayload {
  return {
    items: systemStatusCards,
    total: systemStatusCards.length,
  }
}

export function getDashboardPayload(): DashboardPayload {
  const projects = listStoredProjects()
  const approvals = listStoredApprovals()

  return {
    metrics: buildDashboardMetrics(projects, approvals.filter((approval) => approval.status === "待处理").length),
    priorities: dashboardPriorities,
    leadProject: projects[0],
    approvals,
    assets,
    evidence: evidenceRecords,
    mcpTools,
    projectTasks,
    projects,
  }
}

export function listApprovalsPayload(): ApprovalCollectionPayload {
  const approvals = listStoredApprovals()

  return {
    items: approvals,
    total: approvals.length,
  }
}

export function listAssetsPayload(): AssetCollectionPayload {
  return {
    items: assets,
    total: assets.length,
  }
}

export function getAssetDetailPayload(assetId: string): AssetDetailPayload | null {
  const asset = getAssetById(assetId)

  if (!asset) {
    return null
  }

  return { asset }
}

export function listEvidencePayload(): EvidenceCollectionPayload {
  return {
    items: evidenceRecords,
    total: evidenceRecords.length,
  }
}

export function getEvidenceDetailPayload(evidenceId: string): EvidenceDetailPayload | null {
  const record = getEvidenceById(evidenceId)

  if (!record) {
    return null
  }

  return { record }
}

export function getProjectRecord(projectId: string): ProjectRecord | null {
  return getStoredProjectById(projectId)
}

export function getProjectFormPresetValue(projectId?: string): ProjectFormPreset {
  if (!projectId) {
    return getDefaultProjectFormPreset()
  }

  return getStoredProjectFormPreset(projectId) ?? getDefaultProjectFormPreset()
}

export function createProjectOverviewPayload(input: ProjectMutationInput): ProjectOverviewPayload {
  return createStoredProject(input)
}

export function updateProjectOverviewPayload(
  projectId: string,
  patch: ProjectPatchInput,
): ProjectOverviewPayload | null {
  return updateStoredProject(projectId, patch)
}

export function archiveProjectOverviewPayload(projectId: string): ProjectOverviewPayload | null {
  return archiveStoredProject(projectId)
}

export function listAuditLogsPayload(): LogCollectionPayload {
  const items = listStoredAuditLogs()

  return {
    items,
    total: items.length,
  }
}

export function getApprovalPolicyPayload(): ApprovalPolicyPayload {
  const approvalControl = getStoredGlobalApprovalControl()

  return {
    overview: systemControlOverview.map((item, index) =>
      index === 3
        ? {
            ...item,
            value: approvalControl.enabled ? "审批链路已开启" : "审批链路已关闭",
            description: approvalControl.note,
          }
        : item,
    ),
    approvalControl,
    approvalPolicies: listStoredApprovalPolicies(),
    scopeRules: listStoredScopeRules(),
  }
}

export function updateApprovalDecisionPayload(approvalId: string, input: ApprovalDecisionInput) {
  return updateStoredApprovalDecision(approvalId, input)
}

export function updateGlobalApprovalControlPayload(patch: ApprovalControlPatch) {
  return updateStoredGlobalApprovalControl(patch)
}

export function updateProjectApprovalControlPayload(projectId: string, patch: ApprovalControlPatch) {
  return updateStoredProjectApprovalControl(projectId, patch)
}
