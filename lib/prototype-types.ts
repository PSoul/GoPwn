export type ProjectStage =
  | "授权与范围定义"
  | "种子目标接收"
  | "持续信息收集"
  | "目标关联与范围判定"
  | "发现与指纹识别"
  | "待验证项生成"
  | "审批前排队"
  | "受控 PoC 验证"
  | "证据归档与结果判定"
  | "风险聚合与项目结论"
  | "报告与回归验证"

export type ProjectStatus = "运行中" | "待处理" | "已暂停" | "已停止" | "已阻塞" | "已完成"

export type ProjectSchedulerLifecycle = "idle" | "running" | "paused" | "stopped"

export type Tone = "neutral" | "info" | "success" | "warning" | "danger"

export type TaskStatus =
  | "pending"
  | "ready"
  | "waiting_dependency"
  | "waiting_approval"
  | "scheduled"
  | "running"
  | "succeeded"
  | "failed"
  | "needs_review"
  | "cancelled"

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

export interface ProjectRecord {
  id: string
  code: string
  name: string
  targetInput: string
  targets: string[]
  description: string
  stage: ProjectStage
  status: ProjectStatus
  pendingApprovals: number
  openTasks: number
  assetCount: number
  evidenceCount: number
  createdAt: string
  lastUpdated: string
  lastActor: string
  riskSummary: string
  summary: string
  seed?: string
  targetType?: string
  targetSummary?: string
  owner?: string
  priority?: "高" | "中" | "低"
  authorizationSummary?: string
  scopeSummary?: string
  forbiddenActions?: string
  defaultConcurrency?: string
  rateLimit?: string
  timeout?: string
  approvalMode?: string
  tags?: string[]
}

export interface TimelineStage {
  title: ProjectStage
  state: "done" | "current" | "blocked" | "watching"
  note: string
}

export interface TaskRecord {
  id: string
  projectId: string
  title: string
  status: TaskStatus
  reason: string
  priority: "P1" | "P2" | "P3"
  owner: string
  updatedAt: string
  linkedTarget?: string
}

export interface ProjectKnowledgeItem {
  title: string
  detail: string
  meta: string
  tone: Tone
}

export interface ProjectResultMetric {
  label: string
  value: string
  note: string
  tone: Tone
}

export interface ProjectInventoryItem {
  primary: string
  secondary: string
  meta: string
  status: string
  tone: Tone
}

export interface ProjectInventoryGroup {
  title: string
  description: string
  count: string
  items: ProjectInventoryItem[]
}

export interface ProjectFindingRecord {
  id: string
  projectId: string
  severity: "高危" | "中危" | "低危" | "情报"
  status: "待验证" | "已确认" | "待复核" | "已缓解"
  title: string
  summary: string
  affectedSurface: string
  evidenceId: string
  owner: string
  updatedAt: string
}

export interface ProjectStageSnapshot {
  title: string
  summary: string
  blocker: string
  owner: string
  updatedAt: string
}

export type ProjectClosureState = "waiting_start" | "running" | "blocked" | "settling" | "completed" | "stopped"

export interface ProjectClosureBlockerRecord {
  title: string
  detail: string
  tone: Tone
}

export interface ProjectClosureStatusRecord {
  state: ProjectClosureState
  label: string
  tone: Tone
  summary: string
  blockers: ProjectClosureBlockerRecord[]
  reportExported: boolean
  finalConclusionGenerated: boolean
}

export interface ProjectConclusionRecord {
  id: string
  projectId: string
  generatedAt: string
  source: "reviewer" | "fallback"
  summary: string
  keyPoints: string[]
  nextActions: string[]
  assetCount: number
  evidenceCount: number
  findingCount: number
}

export interface ApprovalControl {
  enabled: boolean
  mode: string
  autoApproveLowRisk: boolean
  description: string
  note: string
}

export interface ProjectSchedulerControl {
  lifecycle: ProjectSchedulerLifecycle
  paused: boolean
  autoReplan: boolean
  maxRounds: number
  currentRound: number
  note: string
  updatedAt: string
}

export interface OrchestratorRoundRecord {
  round: number
  startedAt: string
  completedAt: string
  planItemCount: number
  executedCount: number
  newAssetCount: number
  newEvidenceCount: number
  newFindingCount: number
  failedActions: string[]
  blockedByApproval: string[]
  summaryForNextRound: string
}

export interface ProjectDetailRecord {
  projectId: string
  target: string
  blockingReason: string
  nextStep: string
  reflowNotice: string
  currentFocus: string
  timeline: TimelineStage[]
  tasks: TaskRecord[]
  discoveredInfo: ProjectKnowledgeItem[]
  serviceSurface: ProjectKnowledgeItem[]
  fingerprints: ProjectKnowledgeItem[]
  entries: ProjectKnowledgeItem[]
  scheduler: ProjectKnowledgeItem[]
  activity: ProjectKnowledgeItem[]
  resultMetrics: ProjectResultMetric[]
  assetGroups: ProjectInventoryGroup[]
  findings: ProjectFindingRecord[]
  currentStage: ProjectStageSnapshot
  approvalControl: ApprovalControl
  closureStatus: ProjectClosureStatusRecord
  finalConclusion: ProjectConclusionRecord | null
}

export interface ProjectFormPreset {
  name: string
  targetInput: string
  description: string
  seed?: string
  targetType?: string
  owner?: string
  priority?: "高" | "中" | "低"
  targetSummary?: string
  authorizationSummary?: string
  scopeSummary?: string
  forbiddenActions?: string
  defaultConcurrency?: string
  rateLimit?: string
  timeout?: string
  approvalMode?: string
  tags?: string
  deliveryNotes?: string
}

export type AssetViewKey =
  | "domains-web"
  | "hosts-ip"
  | "ports-services"
  | "fingerprints"
  | "pending-review"

export interface AssetCollectionView {
  key: AssetViewKey
  label: string
  description: string
  count: number
  items: AssetRecord[]
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

export interface ApprovalRecord {
  id: string
  projectId: string
  projectName: string
  target: string
  actionType: string
  riskLevel: "高" | "中" | "低"
  rationale: string
  impact: string
  mcpCapability: string
  tool: string
  status: "待处理" | "已批准" | "已拒绝" | "已延后"
  parameterSummary: string
  prerequisites: string[]
  stopCondition: string
  blockingImpact: string
  queuePosition: number
  submittedAt: string
}

export interface AssetRelation {
  id: string
  label: string
  type: string
  relation: string
  scopeStatus: "已纳入" | "待确认" | "待复核"
}

export interface AssetRecord {
  id: string
  projectId: string
  projectName: string
  type: string
  label: string
  profile: string
  scopeStatus: "已纳入" | "待确认" | "待复核"
  lastSeen: string
  host: string
  ownership: string
  confidence: string
  exposure: string
  linkedEvidenceId: string
  linkedTaskTitle: string
  issueLead: string
  relations: AssetRelation[]
}

export interface EvidenceRecord {
  id: string
  projectId: string
  projectName: string
  title: string
  source: string
  confidence: string
  conclusion: string
  linkedApprovalId: string
  rawOutput: string[]
  screenshotNote: string
  structuredSummary: string[]
  linkedTaskTitle: string
  linkedAssetLabel: string
  timeline: string[]
  verdict: string
  capturedUrl?: string
  screenshotArtifactPath?: string
  htmlArtifactPath?: string
}

export interface McpToolRecord {
  id: string
  capability: string
  toolName: string
  version: string
  riskLevel: "高" | "中" | "低"
  status: "启用" | "禁用" | "异常"
  category: string
  description: string
  inputMode: string
  outputMode: string
  boundary: "外部目标交互" | "平台内部处理" | "外部第三方API"
  requiresApproval: boolean
  endpoint: string
  owner: string
  defaultConcurrency: string
  rateLimit: string
  timeout: string
  retry: string
  lastCheck: string
  notes: string
}

export interface McpCapabilityRecord {
  id: string
  name: string
  description: string
  defaultRiskLevel: "高" | "中" | "低"
  defaultApprovalRule: string
  boundary: "外部目标交互" | "平台内部处理" | "外部第三方API"
  mappedStages: string[]
  connectedTools: string[]
}

export interface McpBoundaryRule {
  title: string
  description: string
  type: "外部目标交互" | "平台内部处理" | "外部第三方API"
}

export interface McpRegistrationField {
  label: string
  description: string
}

export type McpServerTransport = "stdio" | "streamable_http" | "sse"

export type McpServerStatus = "已连接" | "停用" | "异常"

export interface McpServerRecord {
  id: string
  serverName: string
  transport: McpServerTransport
  command: string
  args: string[]
  endpoint: string
  enabled: boolean
  status: McpServerStatus
  toolBindings: string[]
  notes: string
  lastSeen: string
}

export interface McpServerInvocationRecord {
  id: string
  serverId: string
  toolName: string
  status: "succeeded" | "failed" | "timeout" | "cancelled"
  target: string
  summary: string
  durationMs: number
  createdAt: string
}

export type McpResultMapping = "domains" | "webEntries" | "network" | "findings" | "evidence" | "workLogs" | "assets" | "intelligence"

export interface McpServerContractSummaryRecord {
  serverId: string
  serverName: string
  version: string
  transport: McpServerTransport
  enabled: boolean
  toolNames: string[]
  command?: string
  endpoint: string
  projectId?: string
  updatedAt: string
}

export interface McpToolContractSummaryRecord {
  serverId: string
  serverName: string
  toolName: string
  title: string
  capability: string
  boundary: "外部目标交互" | "平台内部处理" | "外部第三方API"
  riskLevel: "高" | "中" | "低"
  requiresApproval: boolean
  resultMappings: McpResultMapping[]
  projectId?: string
  updatedAt: string
}

export interface McpRunRecord {
  id: string
  projectId: string
  projectName: string
  capability: string
  toolId: string
  toolName: string
  requestedAction: string
  target: string
  riskLevel: "高" | "中" | "低"
  boundary: "外部目标交互" | "平台内部处理" | "外部第三方API"
  dispatchMode: "自动执行" | "审批后执行" | "阻塞"
  status: "待审批" | "执行中" | "已执行" | "已阻塞" | "已拒绝" | "已延后" | "已取消"
  requestedBy: string
  createdAt: string
  updatedAt: string
  connectorMode?: "local" | "real"
  linkedApprovalId?: string
  summaryLines: string[]
}

export type McpSchedulerTaskStatus =
  | "ready"
  | "waiting_approval"
  | "running"
  | "retry_scheduled"
  | "delayed"
  | "completed"
  | "failed"
  | "cancelled"

export interface McpSchedulerTaskRecord {
  id: string
  runId: string
  projectId: string
  projectName: string
  capability: string
  target: string
  toolName: string
  connectorMode: "local" | "real"
  status: McpSchedulerTaskStatus
  attempts: number
  maxAttempts: number
  queuedAt: string
  availableAt: string
  updatedAt: string
  lastError?: string
  linkedApprovalId?: string
  workerId?: string
  leaseToken?: string
  leaseStartedAt?: string
  leaseExpiresAt?: string
  heartbeatAt?: string
  recoveryCount?: number
  lastRecoveredAt?: string
  summaryLines: string[]
}

export interface ControlSetting {
  label: string
  value: string
  description: string
  tone: Tone
}

export interface PolicyRecord {
  title: string
  description: string
  owner: string
  status: string
}

export interface SettingsSectionRecord {
  title: string
  href: string
  description: string
  metric: string
  tone: Tone
}

export interface LlmSettingRecord {
  title: string
  value: string
  description: string
  owner: string
}

export type LlmProfileId = "orchestrator" | "reviewer" | "extractor"

export interface LlmProfileRecord {
  id: LlmProfileId
  provider: string
  label: string
  apiKey: string
  baseUrl: string
  model: string
  timeoutMs: number
  temperature: number
  enabled: boolean
}

export interface LlmSettingsPayload {
  profiles: LlmProfileRecord[]
}

export interface LlmProviderStatus {
  provider: string
  enabled: boolean
  baseUrl: string
  orchestratorModel: string
  reviewerModel: string
  note: string
}

export interface LocalLabRecord {
  id: string
  name: string
  description: string
  baseUrl: string
  healthUrl: string
  image: string
  ports: string[]
  status: "online" | "offline" | "unknown"
  availability: "host" | "container" | "none" | "unknown"
  statusNote: string
  dockerContainerName?: string
  internalBaseUrl?: string
  internalHealthUrl?: string
  effectiveHostPort?: number
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

export interface ApprovalDecisionInput {
  decision: ApprovalRecord["status"]
}

export interface ApprovalControlPatch {
  enabled?: boolean
  autoApproveLowRisk?: boolean
  note?: string
}

export interface ApprovalPolicyPayload {
  overview: ControlSetting[]
  approvalControl: ApprovalControl
  approvalPolicies: PolicyRecord[]
  scopeRules: PolicyRecord[]
}

export interface McpToolPatchInput {
  status?: McpToolRecord["status"]
  defaultConcurrency?: string
  rateLimit?: string
  timeout?: string
  retry?: string
  notes?: string
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

export interface OrchestratorPlanPayload {
  plan: OrchestratorPlanRecord
  provider: LlmProviderStatus
}

export interface LocalValidationRunPayload {
  provider: LlmProviderStatus
  plan: OrchestratorPlanRecord
  localLab: LocalLabRecord
  runs: McpRunRecord[]
  status: "completed" | "waiting_approval" | "blocked"
  approval?: ApprovalRecord
}

export interface ProjectReportExportActionPayload {
  dispatch: McpDispatchPayload
  reportExport: ProjectReportExportPayload
}

// ──────────────────────────────────────────────
// LLM Call Logs
// ──────────────────────────────────────────────

export type LlmCallRole = "orchestrator" | "reviewer" | "extractor"
export type LlmCallPhase = "planning" | "reviewing" | "extracting" | "concluding"
export type LlmCallStatus = "streaming" | "completed" | "failed"

export interface LlmCallLogRecord {
  id: string
  projectId: string
  role: LlmCallRole
  phase: LlmCallPhase
  prompt: string
  response: string
  status: LlmCallStatus
  model: string
  provider: string
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null
  durationMs: number | null
  error: string | null
  createdAt: string
  completedAt: string | null
}

export interface LlmCallLogListPayload {
  items: LlmCallLogRecord[]
  total: number
}

export interface VulnCenterSummaryPayload {
  total: number
  bySeverity: Record<string, number>
  pendingVerification: number
  findings: (ProjectFindingRecord & { projectName: string })[]
}
