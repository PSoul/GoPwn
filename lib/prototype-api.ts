import {
  dashboardMetrics,
  mcpBoundaryRules,
  mcpCapabilityRecords,
  mcpRegistrationFields,
  settingsSections,
  systemControlOverview,
  systemStatusCards,
} from "@/lib/platform-config"
import { listStoredLlmProfiles, updateStoredLlmProfile } from "@/lib/llm-settings-repository"
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
  listStoredMcpRuns,
} from "@/lib/mcp-gateway-repository"
import {
  registerStoredMcpServer,
  listStoredMcpServerInvocations,
  listStoredMcpServers,
} from "@/lib/mcp-server-repository"
import {
  executeProjectLocalValidation,
  generateProjectOrchestratorPlan,
  getProjectOrchestratorPanelPayload,
} from "@/lib/orchestrator-service"
import { dispatchProjectMcpRunAndDrain } from "@/lib/project-mcp-dispatch-service"
import {
  drainStoredSchedulerTasks,
  syncStoredSchedulerTaskAfterApprovalDecision,
} from "@/lib/mcp-scheduler-service"
import { listStoredSchedulerTasks } from "@/lib/mcp-scheduler-repository"
import { runProjectSmokeWorkflow } from "@/lib/mcp-workflow-service"
import {
  getStoredMcpToolById,
  listStoredMcpTools,
  runStoredMcpHealthCheck,
  updateStoredMcpTool,
} from "@/lib/mcp-repository"
import {
  cancelStoredSchedulerTask,
  getStoredProjectSchedulerControl,
  retryStoredSchedulerTask,
  updateStoredProjectSchedulerControl,
} from "@/lib/project-scheduler-control-repository"
import {
  getStoredProjectReportExportPayload,
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
import { getDefaultProjectFormPreset, readPrototypeStore } from "@/lib/prototype-store"
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
  LlmProfileRecord,
  LlmSettingsPayload,
  LogCollectionPayload,
  LocalValidationRunInput,
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
  ProjectOrchestratorPanelPayload,
  ProjectMutationInput,
  ProjectOperationsPayload,
  ProjectOverviewPayload,
  ProjectPatchInput,
  ProjectRecord,
  ProjectReportExportActionPayload,
  ProjectReportExportPayload,
  SettingsSectionsPayload,
  SystemStatusPayload,
  TaskRecord,
  Tone,
} from "@/lib/prototype-types"

function buildDashboardMetrics(projects: ProjectRecord[], approvalTotal: number) {
  const runningProjects = projects.filter((project) => project.status === "运行中").length
  const findings = listStoredProjectFindings()
  const confirmedFindings = findings.filter((finding) => finding.status === "已确认").length
  const assets = listStoredAssets()

  return dashboardMetrics.map((metric) => {
    if (metric.label === "项目总数") {
      return {
        ...metric,
        value: String(projects.length),
        delta: projects.length > 0 ? `${projects.filter((project) => project.status === "待处理").length} 个待启动` : "等待第一个真实项目",
      }
    }

    if (metric.label === "运行中项目") {
      return {
        ...metric,
        value: String(runningProjects),
        delta: runningProjects > 0 ? `${projects.filter((project) => project.status === "已阻塞").length} 个已阻塞` : "等待调度启动",
      }
    }

    if (metric.label === "已发现资产") {
      return {
        ...metric,
        value: String(assets.length),
        delta: assets.length > 0 ? `${assets.filter((asset) => asset.scopeStatus !== "已纳入").length} 个待确认` : "等待真实资产回流",
      }
    }

    if (metric.label === "已确认问题") {
      return {
        ...metric,
        value: String(confirmedFindings),
        delta: findings.length > 0 ? `${findings.filter((finding) => finding.status === "待复核").length} 个待复核` : "等待真实发现沉淀",
      }
    }

    if (metric.label === "待审批动作") {
      return {
        ...metric,
        value: String(approvalTotal),
        delta: approvalTotal > 0 ? `${projects.filter((project) => project.pendingApprovals > 0).length} 个项目受影响` : "当前无审批阻塞",
      }
    }

    return metric
  })
}

function buildDashboardPriorities({
  approvals,
  assets,
  mcpTools,
  projects,
}: {
  approvals: ReturnType<typeof listStoredApprovals>
  assets: ReturnType<typeof listStoredAssets>
  mcpTools: ReturnType<typeof listStoredMcpTools>
  projects: ProjectRecord[]
}) {
  if (projects.length === 0 && approvals.length === 0 && assets.length === 0 && mcpTools.length === 0) {
    return []
  }

  const priorities: Array<{ title: string; detail: string; tone: Tone }> = []
  const pendingApprovals = approvals.filter((approval) => approval.status === "待处理")
  const pendingAssets = assets.filter((asset) => asset.scopeStatus !== "已纳入")
  const abnormalTools = mcpTools.filter((tool) => tool.status === "异常")
  const blockedProjects = projects.filter((project) => project.status === "已阻塞")

  if (pendingApprovals.length > 0) {
    priorities.push({
      title: "审批队列待清理",
      detail: `${pendingApprovals.length} 个动作仍在等待人工确认，优先恢复被阻塞项目的主路径。`,
      tone: "danger",
    })
  }

  if (pendingAssets.length > 0) {
    priorities.push({
      title: "待确认资产需要回流",
      detail: `${pendingAssets.length} 个对象仍待确认或复核，建议先补归属再推进下一步验证。`,
      tone: "warning",
    })
  }

  if (abnormalTools.length > 0) {
    priorities.push({
      title: "MCP 工具健康待处理",
      detail: `${abnormalTools.length} 个工具处于异常状态，继续前请先完成巡检与恢复。`,
      tone: "info",
    })
  }

  if (priorities.length === 0 && blockedProjects.length > 0) {
    priorities.push({
      title: "阻塞项目待恢复",
      detail: `${blockedProjects.length} 个项目处于阻塞状态，建议先进入项目详情查看当前阶段与控制策略。`,
      tone: "warning",
    })
  }

  return priorities
}

function deriveDashboardTasks(projects: ProjectRecord[]): TaskRecord[] {
  if (projects.length === 0) {
    return []
  }

  return projects.flatMap((project) => {
    const detail = getStoredProjectDetailById(project.id)
    return detail?.tasks ?? []
  })
}

function buildMcpSettingsMetric(tools: McpToolRecord[]) {
  const enabledCount = tools.filter((tool) => tool.status === "启用").length
  const abnormalCount = tools.filter((tool) => tool.status === "异常").length

  return `${enabledCount} 启用 / ${abnormalCount} 异常`
}

function buildLlmSettingsMetric(profiles: LlmProfileRecord[]) {
  const enabledProfiles = profiles.filter((profile) => profile.enabled && profile.model).length

  return enabledProfiles > 0 ? `${enabledProfiles} 套已启用` : "等待配置"
}

function buildCapabilityPayloadFromTools(tools: McpToolRecord[]) {
  return mcpCapabilityRecords.map((capability) => ({
    ...capability,
    connectedTools: tools.filter((tool) => tool.capability === capability.name).map((tool) => tool.toolName),
  }))
}

function buildSystemStatusPayloadFromTools(tools: McpToolRecord[]) {
  const store = readPrototypeStore()
  const enabledCount = tools.filter((tool) => tool.status === "启用").length
  const abnormalTools = tools.filter((tool) => tool.status === "异常")
  const activeTasks = store.schedulerTasks.filter((task) => !["succeeded", "failed", "cancelled"].includes(task.status))
  const waitingApprovalTasks = activeTasks.filter((task) => task.status === "waiting_approval").length
  const runningTasks = activeTasks.filter((task) => task.status === "running").length
  const retryTasks = activeTasks.filter((task) => task.status === "scheduled").length
  const browserTools = tools.filter((tool) => tool.capability === "截图与证据采集类" && tool.status === "启用")
  const webSurfaceTools = tools.filter((tool) => tool.capability === "Web 页面探测类" && tool.status === "启用")
  const auditLogTotal = store.auditLogs.length
  const workLogTotal = store.workLogs.length

  return systemStatusCards.map((card) => {
    if (card.title === "MCP 网关") {
      return {
        ...card,
        value: tools.length > 0 ? `${enabledCount} / ${tools.length} 正常` : "0 / 0 已接入",
        description:
          tools.length === 0
            ? "当前还没有注册任何 MCP server 或工具契约。"
            : abnormalTools.length > 0
            ? `${abnormalTools.map((tool) => tool.toolName).join("、")} 当前异常，已影响对应链路。`
            : "所有已注册 MCP 工具当前均处于健康状态。",
        tone: tools.length === 0 ? "neutral" : abnormalTools.length > 0 ? "danger" : "success",
      }
    }

    if (card.title === "调度队列") {
      return {
        ...card,
        value: `${activeTasks.length} 条`,
        description:
          activeTasks.length === 0
            ? "当前没有待运行、待审批或待重试的真实任务。"
            : `${waitingApprovalTasks} 条待审批 / ${runningTasks} 条执行中 / ${retryTasks} 条已排入调度恢复。`,
        tone: activeTasks.length === 0 ? "neutral" : waitingApprovalTasks > 0 ? "warning" : "info",
      }
    }

    if (card.title === "浏览器池") {
      return {
        ...card,
        value: browserTools.length > 0 ? `${browserTools.length} 条已接入` : "未接入",
        description:
          browserTools.length > 0
            ? `当前已注册 ${browserTools.map((tool) => tool.toolName).join("、")}，可用于截图或证据采集。`
            : webSurfaceTools.length > 0
            ? "当前还没有独立浏览器/截图采集节点，但 Web 页面探测链路仍可回流基础入口证据。"
            : "当前还没有浏览器或截图采集能力注册。",
        tone: browserTools.length > 0 ? "success" : webSurfaceTools.length > 0 ? "warning" : "neutral",
      }
    }

    if (card.title === "日志存储") {
      return {
        ...card,
        value: `${workLogTotal + auditLogTotal} 条`,
        description:
          workLogTotal + auditLogTotal > 0
            ? `工作日志 ${workLogTotal} 条 / 审计日志 ${auditLogTotal} 条，均已进入真实持久化存储。`
            : "当前还没有真实日志写入，等项目执行或配置变更后这里会开始累积。",
        tone: workLogTotal + auditLogTotal > 0 ? "success" : "info",
      }
    }

    return card
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

export async function getProjectOperationsPayload(projectId: string): Promise<ProjectOperationsPayload | null> {
  const base = getProjectBase(projectId)

  if (!base) {
    return null
  }

  return {
    ...base,
    approvals: listStoredProjectApprovals(projectId),
    mcpRuns: listStoredMcpRuns(projectId),
    schedulerControl: getStoredProjectSchedulerControl(projectId) ?? {
      paused: false,
      note: "默认允许调度器处理 ready / retry / delayed 任务。",
      updatedAt: base.project.lastUpdated,
    },
    schedulerTasks: listStoredSchedulerTasks(projectId),
    orchestrator: await getProjectOrchestratorPanelPayload(projectId),
    reportExport: getStoredProjectReportExportPayload(projectId),
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
  const llmProfiles = listStoredLlmProfiles()
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

      if (section.href === "/settings/llm") {
        return {
          ...section,
          metric: buildLlmSettingsMetric(llmProfiles),
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
  const pendingApprovalCount = approvals.filter((approval) => approval.status === "待处理").length
  const priorities = buildDashboardPriorities({ projects, approvals, assets, mcpTools })
  const leadProject = projects[0] ?? null

  return {
    metrics: buildDashboardMetrics(projects, pendingApprovalCount),
    priorities,
    leadProject,
    approvals,
    assets,
    evidence,
    mcpTools,
    projectTasks: deriveDashboardTasks(projects),
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

export async function updateApprovalDecisionPayload(approvalId: string, input: ApprovalDecisionInput) {
  const approval = updateStoredApprovalDecision(approvalId, input)

  if (!approval) {
    return approval
  }

  syncStoredSchedulerTaskAfterApprovalDecision(approval)

  if (approval.status === "已批准") {
    const linkedRunId = listStoredMcpRuns().find((item) => item.linkedApprovalId === approval.id)?.id

    if (linkedRunId) {
      await drainStoredSchedulerTasks({
        runId: linkedRunId,
      })
    }
  }

  return approval
}

export function updateGlobalApprovalControlPayload(patch: ApprovalControlPatch) {
  return updateStoredGlobalApprovalControl(patch)
}

export function updateProjectApprovalControlPayload(projectId: string, patch: ApprovalControlPatch) {
  return updateStoredProjectApprovalControl(projectId, patch)
}

export function updateProjectSchedulerControlPayload(
  projectId: string,
  patch: Parameters<typeof updateStoredProjectSchedulerControl>[1],
) {
  return updateStoredProjectSchedulerControl(projectId, patch)
}

export function runProjectSchedulerTaskActionPayload(
  projectId: string,
  taskId: string,
  action: "cancel" | "retry",
  note?: string,
) {
  return action === "cancel"
    ? cancelStoredSchedulerTask(projectId, taskId, note)
    : retryStoredSchedulerTask(projectId, taskId, note)
}

export function getMcpSettingsPayload(): McpSettingsPayload {
  const store = readPrototypeStore()
  const tools = listStoredMcpTools()

  return {
    tools,
    servers: listStoredMcpServers(),
    recentInvocations: listStoredMcpServerInvocations(undefined, 6),
    capabilities: buildCapabilityPayloadFromTools(tools),
    boundaryRules: mcpBoundaryRules,
    registrationFields: mcpRegistrationFields,
    serverContracts: store.mcpServerContracts,
    toolContracts: store.mcpToolContracts,
  }
}

export function getLlmSettingsPayload(): LlmSettingsPayload {
  return {
    profiles: listStoredLlmProfiles(),
  }
}

export function updateLlmSettingsPayload(profile: LlmProfileRecord) {
  return updateStoredLlmProfile(profile)
}

export function registerMcpServerPayload(input: Parameters<typeof registerStoredMcpServer>[0]) {
  return registerStoredMcpServer(input)
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

export async function dispatchProjectMcpRunPayload(
  projectId: string,
  input: McpDispatchInput,
): Promise<McpDispatchPayload | null> {
  return dispatchProjectMcpRunAndDrain(projectId, input)
}

export async function runProjectMcpWorkflowSmokePayload(
  projectId: string,
  input: McpWorkflowSmokeInput,
): Promise<McpWorkflowSmokePayload | null> {
  return runProjectSmokeWorkflow(projectId, input.scenario)
}

export function listWorkLogsPayload(): LogCollectionPayload {
  const items = listStoredWorkLogs()

  return {
    items,
    total: items.length,
  }
}

export async function getProjectOrchestratorPayload(
  projectId: string,
): Promise<ProjectOrchestratorPanelPayload | null> {
  const project = getStoredProjectById(projectId)

  if (!project) {
    return null
  }

  return getProjectOrchestratorPanelPayload(projectId)
}

export async function generateProjectOrchestratorPlanPayload(
  projectId: string,
  input: LocalValidationRunInput,
) {
  const project = getStoredProjectById(projectId)

  if (!project) {
    return null
  }

  return generateProjectOrchestratorPlan(projectId, input)
}

export async function executeProjectLocalValidationPayload(projectId: string, input: LocalValidationRunInput) {
  const project = getStoredProjectById(projectId)

  if (!project) {
    return null
  }

  return executeProjectLocalValidation(projectId, input)
}

export function getProjectReportExportPayload(projectId: string): ProjectReportExportPayload | null {
  const project = getStoredProjectById(projectId)

  if (!project) {
    return null
  }

  return getStoredProjectReportExportPayload(projectId)
}

export async function triggerProjectReportExportPayload(
  projectId: string,
): Promise<ProjectReportExportActionPayload | null> {
  const project = getStoredProjectById(projectId)

  if (!project) {
    return null
  }

  const dispatch = await dispatchProjectMcpRunAndDrain(projectId, {
    capability: "报告导出类",
    requestedAction: "导出项目报告",
    target: project.code,
    riskLevel: "低",
  })

  if (!dispatch) {
    return null
  }

  return {
    dispatch,
    reportExport: getStoredProjectReportExportPayload(projectId),
  }
}
