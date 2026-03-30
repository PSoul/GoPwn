import type { ProjectRecord, ProjectDetailRecord, ProjectFormPreset, ProjectFindingRecord, ProjectInventoryGroup, ProjectConclusionRecord, Tone, TaskRecord } from "./project"
import type { ApprovalRecord } from "./approval"
import type { McpToolRecord, McpServerRecord, McpServerInvocationRecord, McpCapabilityRecord, McpBoundaryRule, McpRegistrationField, McpServerContractSummaryRecord, McpToolContractSummaryRecord, McpRunRecord } from "./mcp"
import type { ProjectSchedulerControl, McpSchedulerTaskRecord, OrchestratorRoundRecord } from "./scheduler"
import type { AssetRecord, AssetCollectionView } from "./asset"
import type { EvidenceRecord } from "./evidence"
import type { SettingsSectionRecord, LlmProviderStatus, LocalLabRecord } from "./settings"

export interface MetricCard {
  label: string
  value: string
  delta: string
  tone: Tone
}

export interface DashboardPriorityRecord {
  title: string
  detail: string
  tone: Tone
}

export interface DashboardRecentResultRecord {
  id: string
  title: string
  subtitle: string
  meta: string
  href: string
  status: string
  tone: Tone
}

export interface DashboardSystemRecord {
  title: string
  value: string
  detail: string
  href: string
  tone: Tone
}

export interface LogRecord {
  id: string
  category: string
  summary: string
  projectName?: string
  actor: string
  timestamp: string
  status: string
}

export interface SystemStatusRecord {
  title: string
  value: string
  description: string
  tone: Tone
}

export interface ApiErrorPayload {
  error: string
}

export type ProjectMutationInput = ProjectFormPreset

export type ProjectPatchInput = Partial<ProjectMutationInput>

export interface ProjectCollectionPayload {
  items: ProjectRecord[]
  total: number
}

export interface ProjectOverviewPayload {
  project: ProjectRecord
  detail: ProjectDetailRecord
}

export interface ProjectFlowPayload {
  project: ProjectRecord
  detail: ProjectDetailRecord
}

export interface ProjectOperationsPayload {
  project: ProjectRecord
  detail: ProjectDetailRecord
  approvals: ApprovalRecord[]
  mcpRuns: McpRunRecord[]
  schedulerControl: ProjectSchedulerControl
  schedulerTasks: McpSchedulerTaskRecord[]
  orchestrator: ProjectOrchestratorPanelPayload
  reportExport: ProjectReportExportPayload
  orchestratorRounds: OrchestratorRoundRecord[]
}

export interface ProjectContextPayload {
  project: ProjectRecord
  detail: ProjectDetailRecord
  approvals: ApprovalRecord[]
  assets: AssetRecord[]
  evidence: EvidenceRecord[]
}

export interface ProjectInventoryPayload {
  project: ProjectRecord
  group: ProjectInventoryGroup
}

export interface ProjectFindingsPayload {
  project: ProjectRecord
  findings: ProjectFindingRecord[]
}

export interface SettingsSectionsPayload {
  items: SettingsSectionRecord[]
  total: number
}

export interface SystemStatusPayload {
  items: SystemStatusRecord[]
  total: number
}

export interface LogCollectionPayload {
  items: LogRecord[]
  total: number
}

export interface DashboardPayload {
  metrics: MetricCard[]
  priorities: DashboardPriorityRecord[]
  leadProject: ProjectRecord | null
  approvals: ApprovalRecord[]
  assets: AssetRecord[]
  evidence: EvidenceRecord[]
  mcpTools: McpToolRecord[]
  projectTasks: TaskRecord[]
  projects: ProjectRecord[]
  assetViews: AssetCollectionView[]
  recentResults: DashboardRecentResultRecord[]
  systemOverview: DashboardSystemRecord[]
}

export interface ApprovalCollectionPayload {
  items: ApprovalRecord[]
  total: number
}

export interface AssetCollectionPayload {
  items: AssetRecord[]
  total: number
  views: AssetCollectionView[]
}

export interface AssetDetailPayload {
  asset: AssetRecord
}

export interface EvidenceCollectionPayload {
  items: EvidenceRecord[]
  total: number
}

export interface EvidenceDetailPayload {
  record: EvidenceRecord
  artifacts?: {
    screenshotUrl?: string
    htmlUrl?: string
  }
}

export interface McpSettingsPayload {
  tools: McpToolRecord[]
  servers: McpServerRecord[]
  recentInvocations: McpServerInvocationRecord[]
  capabilities: McpCapabilityRecord[]
  boundaryRules: McpBoundaryRule[]
  registrationFields: McpRegistrationField[]
  serverContracts: McpServerContractSummaryRecord[]
  toolContracts: McpToolContractSummaryRecord[]
}

export interface McpDispatchInput {
  capability: string
  requestedAction: string
  target: string
  riskLevel: "高" | "中" | "低"
  preferredToolName?: string
}

export interface McpDispatchPayload {
  run: McpRunRecord
  approval?: ApprovalRecord
}

export interface McpRunCollectionPayload {
  items: McpRunRecord[]
  total: number
}

export interface McpWorkflowSmokeInput {
  scenario: "baseline" | "with-approval"
}

export interface LocalValidationRunInput {
  labId: string
  approvalScenario?: "none" | "include-high-risk"
}

export interface McpWorkflowSmokePayload {
  workflowId: string
  status: "completed" | "waiting_approval" | "blocked"
  runs: McpRunRecord[]
  blockedRun?: McpRunRecord
  approval?: ApprovalRecord
  outputs: {
    normalizedTargets?: string[]
    discoveredSubdomains?: string[]
    webEntries?: string[]
    validatedTargets?: string[]
    generatedFindings?: string[]
    reportDigest?: string[]
  }
}

export interface OrchestratorPlanItem {
  capability: string
  requestedAction: string
  target: string
  riskLevel: "高" | "中" | "低"
  rationale: string
  toolName?: string
}

export interface OrchestratorPlanRecord {
  generatedAt: string
  provider: string
  summary: string
  items: OrchestratorPlanItem[]
}

export interface OrchestratorPlanPayload {
  plan: OrchestratorPlanRecord
  provider: LlmProviderStatus
}

export interface ProjectOrchestratorPanelPayload {
  provider: LlmProviderStatus
  localLabs: LocalLabRecord[]
  lastPlan: OrchestratorPlanRecord | null
}

export interface ProjectReportExportRecord {
  id: string
  projectId: string
  runId: string
  exportedAt: string
  summary: string
  digestLines: string[]
  assetCount: number
  evidenceCount: number
  findingCount: number
  conclusionSummary: string | null
  conclusionGeneratedAt: string | null
  conclusionSource: ProjectConclusionRecord["source"] | null
}

export interface ProjectReportExportPayload {
  latest: ProjectReportExportRecord | null
  totalExports: number
  finalConclusion: ProjectConclusionRecord | null
}

export interface ProjectReportExportActionPayload {
  dispatch: McpDispatchPayload
  reportExport: ProjectReportExportPayload
}

export interface LocalValidationRunPayload {
  provider: LlmProviderStatus
  plan: OrchestratorPlanRecord
  localLab: LocalLabRecord
  runs: McpRunRecord[]
  status: "completed" | "waiting_approval" | "blocked"
  approval?: ApprovalRecord
}

export interface VulnCenterSummaryPayload {
  total: number
  bySeverity: Record<string, number>
  pendingVerification: number
  findings: (ProjectFindingRecord & { projectName: string })[]
}
