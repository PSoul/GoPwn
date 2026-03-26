import {
  dashboardMetrics,
  dashboardPriorities,
  mcpBoundaryRules,
  mcpCapabilityRecords,
  projectTasks,
  mcpRegistrationFields,
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
  getStoredAssetById,
  listStoredAssets,
} from "@/lib/asset-repository"
import {
  getStoredEvidenceById,
  listStoredEvidence,
} from "@/lib/evidence-repository"
import {
  executeStoredMcpRun,
  resumeStoredApprovedMcpRun,
} from "@/lib/mcp-execution-service"
import {
  dispatchStoredMcpRun,
  listStoredMcpRuns,
} from "@/lib/mcp-gateway-repository"
import { runProjectSmokeWorkflow } from "@/lib/mcp-workflow-service"
import {
  getStoredMcpToolById,
  listStoredMcpTools,
  runStoredMcpHealthCheck,
  updateStoredMcpTool,
} from "@/lib/mcp-repository"
import {
  listStoredProjectFindings,
} from "@/lib/project-results-repository"
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
import { listStoredWorkLogs } from "@/lib/work-log-repository"
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
  McpDispatchInput,
  McpDispatchPayload,
  McpRunCollectionPayload,
  McpSettingsPayload,
  McpToolPatchInput,
  McpToolRecord,
  McpWorkflowSmokeInput,
  McpWorkflowSmokePayload,
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

function buildMcpSettingsMetric(tools: McpToolRecord[]) {
  const enabledCount = tools.filter((tool) => tool.status === "启用").length
  const abnormalCount = tools.filter((tool) => tool.status === "异常").length

  return `${enabledCount} 启用 / ${abnormalCount} 异常`
}

function buildSystemStatusPayloadFromTools(tools: McpToolRecord[]) {
  const enabledCount = tools.filter((tool) => tool.status === "启用").length
  const abnormalTools = tools.filter((tool) => tool.status === "异常")

  return systemStatusCards.map((card) => {
    if (card.title !== "MCP 网关") {
      return card
    }

    return {
      ...card,
      value: `${enabledCount} / ${tools.length} 正常`,
      description:
        abnormalTools.length > 0
          ? `${abnormalTools.map((tool) => tool.toolName).join("、")} 当前异常，已影响对应链路。`
          : "所有已注册 MCP 工具当前均处于健康状态。",
      tone: abnormalTools.length > 0 ? "danger" : "success",
    }
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
    mcpRuns: listStoredMcpRuns(projectId),
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
    assets: listStoredAssets(projectId),
    evidence: listStoredEvidence(projectId),
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
    findings: listStoredProjectFindings(projectId),
  }
}

export function getSettingsSectionsPayload(): SettingsSectionsPayload {
  const auditTotal = listStoredAuditLogs().length
  const approvalControl = getStoredGlobalApprovalControl()
  const mcpTools = listStoredMcpTools()
  const workLogTotal = listStoredWorkLogs().length

  return {
    items: settingsSections.map((section) => {
      if (section.href === "/settings/mcp-tools") {
        return {
          ...section,
          metric: buildMcpSettingsMetric(mcpTools),
        }
      }

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

      if (section.href === "/settings/work-logs") {
        return {
          ...section,
          metric: `${workLogTotal} 条工作日志`,
        }
      }

      return section
    }),
    total: settingsSections.length,
  }
}

export function getSystemStatusPayload(): SystemStatusPayload {
  const items = buildSystemStatusPayloadFromTools(listStoredMcpTools())

  return {
    items,
    total: items.length,
  }
}

export function getDashboardPayload(): DashboardPayload {
  const projects = listStoredProjects()
  const approvals = listStoredApprovals()
  const mcpTools = listStoredMcpTools()
  const assets = listStoredAssets()
  const evidence = listStoredEvidence()

  return {
    metrics: buildDashboardMetrics(projects, approvals.filter((approval) => approval.status === "待处理").length),
    priorities: dashboardPriorities,
    leadProject: projects[0],
    approvals,
    assets,
    evidence,
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
  const items = listStoredAssets()

  return {
    items,
    total: items.length,
  }
}

export function getAssetDetailPayload(assetId: string): AssetDetailPayload | null {
  const asset = getStoredAssetById(assetId)

  if (!asset) {
    return null
  }

  return { asset }
}

export function listEvidencePayload(): EvidenceCollectionPayload {
  const items = listStoredEvidence()

  return {
    items,
    total: items.length,
  }
}

export function getEvidenceDetailPayload(evidenceId: string): EvidenceDetailPayload | null {
  const record = getStoredEvidenceById(evidenceId)

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
  const approval = updateStoredApprovalDecision(approvalId, input)

  if (approval?.status === "已批准") {
    resumeStoredApprovedMcpRun(approval.id)
  }

  return approval
}

export function updateGlobalApprovalControlPayload(patch: ApprovalControlPatch) {
  return updateStoredGlobalApprovalControl(patch)
}

export function updateProjectApprovalControlPayload(projectId: string, patch: ApprovalControlPatch) {
  return updateStoredProjectApprovalControl(projectId, patch)
}

export function getMcpSettingsPayload(): McpSettingsPayload {
  return {
    tools: listStoredMcpTools(),
    capabilities: mcpCapabilityRecords,
    boundaryRules: mcpBoundaryRules,
    registrationFields: mcpRegistrationFields,
  }
}

export function getMcpToolPayload(toolId: string) {
  return getStoredMcpToolById(toolId)
}

export function updateMcpToolPayload(toolId: string, patch: McpToolPatchInput) {
  return updateStoredMcpTool(toolId, patch)
}

export function runMcpHealthCheckPayload(toolId: string) {
  return runStoredMcpHealthCheck(toolId)
}

export function listProjectMcpRunsPayload(projectId: string): McpRunCollectionPayload | null {
  const project = getStoredProjectById(projectId)

  if (!project) {
    return null
  }

  const items = listStoredMcpRuns(projectId)

  return {
    items,
    total: items.length,
  }
}

export function dispatchProjectMcpRunPayload(
  projectId: string,
  input: McpDispatchInput,
): McpDispatchPayload | null {
  const payload = dispatchStoredMcpRun(projectId, input)

  if (!payload || payload.approval || payload.run.status !== "已执行") {
    return payload
  }

  const executed = executeStoredMcpRun(payload.run.id)

  return {
    ...payload,
    run: executed?.run ?? payload.run,
  }
}

export function runProjectMcpWorkflowSmokePayload(
  projectId: string,
  input: McpWorkflowSmokeInput,
): McpWorkflowSmokePayload | null {
  return runProjectSmokeWorkflow(projectId, input.scenario)
}

export function listWorkLogsPayload(): LogCollectionPayload {
  const items = listStoredWorkLogs()

  return {
    items,
    total: items.length,
  }
}
