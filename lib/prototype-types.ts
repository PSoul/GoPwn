/**
 * Backward-compatible type aliases and interfaces.
 *
 * Maps old v1 type names to new Prisma v2 models where a direct equivalent
 * exists, and defines minimal standalone interfaces for view-layer types that
 * have no direct Prisma counterpart. This file is type-only — no runtime code.
 */

import type {
  Project,
  Target,
  Asset,
  Fingerprint,
  Evidence,
  Finding,
  Poc,
  McpRun,
  McpTool,
  McpServer,
  Approval,
  OrchestratorPlan,
  OrchestratorRound,
  LlmCallLog,
  AuditEvent,
  LlmProfile,
  GlobalConfig,
  User,
} from "@/lib/generated/prisma"

import type {
  ProjectLifecycle,
  PentestPhase,
  AssetKind,
  FindingStatus,
  Severity,
  RiskLevel,
  ApprovalStatus,
  McpRunStatus,
  LlmCallStatus,
} from "@/lib/generated/prisma"

// Re-export Prisma enums so consumers importing from this file still get them
export type {
  ProjectLifecycle,
  PentestPhase,
  AssetKind,
  FindingStatus,
  Severity,
  RiskLevel,
  ApprovalStatus,
  McpRunStatus,
  LlmCallStatus,
}

// Re-export raw Prisma models for callers that import them by canonical name
export type {
  Project,
  Target,
  Asset,
  Fingerprint,
  Evidence,
  Finding,
  Poc,
  McpRun,
  McpTool,
  McpServer,
  Approval,
  OrchestratorPlan,
  OrchestratorRound,
  LlmCallLog,
  AuditEvent,
  LlmProfile,
  GlobalConfig,
  User,
}

// ---------------------------------------------------------------------------
// Tone — a shared visual intent token used across many components
// ---------------------------------------------------------------------------

export type Tone = "neutral" | "info" | "success" | "warning" | "danger"

// ---------------------------------------------------------------------------
// LLM roles
// ---------------------------------------------------------------------------

export type LlmCallRole = "orchestrator" | "reviewer" | "analyzer"

// ---------------------------------------------------------------------------
// User-related enums
// ---------------------------------------------------------------------------

export type UserRole = "admin" | "operator" | "viewer"
export type UserStatus = "active" | "disabled"

// ---------------------------------------------------------------------------
// Project status (Chinese labels used by the UI)
// ---------------------------------------------------------------------------

export type ProjectStatus = "待启动" | "运行中" | "已暂停" | "等待审批" | "已完成" | "已停止"

// ---------------------------------------------------------------------------
// Direct Prisma aliases — flat view-model types with extra UI fields
// ---------------------------------------------------------------------------

/**
 * ProjectRecord: Prisma `Project` extended with pre-computed view fields the
 * card / list components expect (targets, counts, stage, status label, etc.).
 */
export interface ProjectRecord {
  id: string
  name: string
  code: string
  description?: string | null
  status: ProjectStatus
  stage: string
  targets: string[]
  summary?: string | null
  assetCount: number
  evidenceCount: number
  pendingApprovals: number
  openTasks: number
  lastUpdated: string
  createdAt: string
}

/**
 * ApprovalRecord: Prisma `Approval` projected to Chinese-label UI fields.
 */
export interface ApprovalRecord {
  id: string
  projectId: string
  mcpRunId?: string | null
  target: string
  actionType: string
  riskLevel: "高" | "中" | "低"
  rationale: string
  status: "待处理" | "已批准" | "已拒绝" | "已延后"
  decidedAt?: string | null
  decisionNote?: string | null
  createdAt: string
}

/**
 * McpRunRecord: Prisma `McpRun` projected with Chinese labels for UI.
 */
export interface McpRunRecord {
  id: string
  projectId: string
  capability: string
  requestedAction: string
  target: string
  toolName: string
  riskLevel: "高" | "中" | "低"
  status: "待审批" | "执行中" | "已执行" | "已阻塞" | "已拒绝" | "已延后" | "已取消"
  dispatchMode: string
  connectorMode?: "real" | "local" | null
  linkedApprovalId?: string | null
  summaryLines: string[]
  createdAt: string
}

/**
 * McpToolRecord: Prisma `McpTool` extended with UI-specific fields.
 */
export interface McpToolRecord {
  id: string
  serverName: string
  toolName: string
  version: string
  capability: string
  category: string
  boundary: string
  riskLevel: "高" | "中" | "低"
  requiresApproval: boolean
  description: string
  status: "启用" | "禁用" | "异常"
  defaultConcurrency: string
  rateLimit: string
  timeout: string
  retry: string
  lastCheck: string
  notes: string
  inputSchema?: unknown
  inputMode: string
  outputMode: string
  endpoint: string
  owner: string
  enabled: boolean
}

/**
 * McpServerRecord: Prisma `McpServer` projected for UI.
 */
export interface McpServerRecord {
  id: string
  serverName: string
  transport: string
  command?: string | null
  args: string[]
  endpoint?: string | null
  enabled: boolean
  status: string
  toolBindings: string[]
  lastSeen: string
  notes?: string | null
  createdAt: string
  updatedAt: string
}

/**
 * LlmCallLogRecord: Prisma `LlmCallLog` projected for the LLM log panel.
 */
export interface LlmCallLogRecord {
  id: string
  projectId: string
  role: LlmCallRole
  phase: string
  prompt: string
  response: string
  status: "streaming" | "completed" | "failed"
  model: string
  provider: string
  durationMs?: number | null
  error?: string | null
  createdAt: string
}

/**
 * OrchestratorRoundRecord: Prisma `OrchestratorRound` projected for UI.
 */
export interface OrchestratorRoundRecord {
  id: string
  projectId: string
  round: number
  phase: string
  status: string
  planItemCount: number
  executedCount: number
  newAssetCount: number
  newFindingCount: number
  newEvidenceCount: number
  startedAt: string
  completedAt?: string | null
}

/**
 * LlmProfileRecord: Prisma `LlmProfile` projected for settings panel.
 */
export interface LlmProfileRecord {
  id: string
  label: string
  provider: string
  apiKey: string
  baseUrl: string
  model: string
  timeoutMs: number
  temperature: number
  contextWindowSize: number
  role?: string
  enabled?: boolean
}

/**
 * ProjectFindingRecord: Prisma `Finding` projected with Chinese labels.
 */
export interface ProjectFindingRecord {
  id: string
  projectId: string
  title: string
  summary: string
  affectedSurface: string
  severity: "高危" | "中危" | "低危" | "信息"
  status: "待验证" | "已确认" | "待复核" | "已缓解"
  evidenceId: string
  updatedAt: string
}

/**
 * AssetRecord: Prisma `Asset` projected with UI-specific view fields.
 */
export interface AssetRecord {
  id: string
  projectId: string
  projectName: string
  label: string
  type: string
  host: string
  profile: string
  exposure: string
  ownership: string
  confidence: string
  issueLead: string
  scopeStatus: "已确认" | "待验证" | "需人工判断"
  lastSeen: string
}

// ---------------------------------------------------------------------------
// Composite / view-only types — no direct Prisma equivalent
// ---------------------------------------------------------------------------

/** Dashboard asset grouping view used by asset-table and asset-center. */
export interface AssetCollectionView {
  key: "domains-web" | "hosts-ip" | "services" | "all"
  label: string
  count: number
  assets: AssetRecord[]
}

/** Project form pre-fill values. */
export interface ProjectFormPreset {
  name?: string
  targetInput?: string
  description?: string
  approvalMode?: "default" | "auto"
}

// ---------------------------------------------------------------------------
// Project detail & live dashboard
// ---------------------------------------------------------------------------

export interface ProjectDetailRecord {
  approvalControl: ApprovalControl
  currentStage: {
    label: string
    summary: string
    items?: Array<{ title: string; detail: string; meta: string }>
  }
  finalConclusion?: {
    summary: string
    source: "reviewer" | "auto"
    keyPoints: string[]
  } | null
  closureStatus: ProjectClosureStatusRecord
  resultMetrics: Array<{
    label: string
    value: string | number
    note: string
    tone: Tone
  }>
  activity: Array<{
    title: string
    detail: string
    meta: string
  }>
}

export interface ProjectLiveDashboardMetrics {
  assetCount: number
  vulnCount: number
  highCount: number
  pendingApprovals: number
}

// ---------------------------------------------------------------------------
// Approval control & policy (system-wide + project-level)
// ---------------------------------------------------------------------------

export interface ApprovalControl {
  enabled: boolean
  autoApproveLowRisk: boolean
  mode?: string
  description?: string
  note?: string
}

export interface ControlSetting {
  label: string
  value: string | number
  description?: string
}

export interface PolicyRecord {
  id: string
  title: string
  description: string
  enabled: boolean
  status?: string
  owner?: string
  tone?: Tone
}

// ---------------------------------------------------------------------------
// Scheduler & orchestrator
// ---------------------------------------------------------------------------

export type ProjectSchedulerLifecycle = "idle" | "running" | "paused" | "stopped"

export interface ProjectSchedulerControl {
  lifecycle: ProjectSchedulerLifecycle
  currentRound?: number
  maxRounds?: number
  note?: string
}

export interface McpSchedulerTaskRecord {
  id: string
  projectId: string
  toolName: string
  target: string
  capability: string
  status:
    | "ready"
    | "waiting_approval"
    | "running"
    | "retry_scheduled"
    | "delayed"
    | "completed"
    | "failed"
    | "cancelled"
}

export interface ProjectClosureStatusRecord {
  state: string
  label: string
  tone: Tone
  summary?: string
}

// ---------------------------------------------------------------------------
// Orchestrator panel (AI plan + local lab)
// ---------------------------------------------------------------------------

export interface OrchestratorPlanPayload {
  plan: unknown
  provider: OrchestratorProviderInfo
}

export interface OrchestratorProviderInfo {
  provider: string
  enabled: boolean
  note: string
  orchestratorModel?: string
  baseUrl?: string
}

export interface ProjectOrchestratorPanelPayload {
  provider: OrchestratorProviderInfo
  lastPlan: unknown | null
  localLabs: LocalLabRecord[]
}

export interface LocalLabRecord {
  id: string
  name: string
  status: "online" | "offline" | "unknown"
}

export interface LocalValidationRunPayload {
  plan: unknown
  provider: OrchestratorProviderInfo
  localLab: LocalLabRecord
  status: "completed" | "waiting_approval" | "blocked"
  approval?: { id: string } | null
}

// ---------------------------------------------------------------------------
// MCP workflow smoke test
// ---------------------------------------------------------------------------

export interface McpWorkflowSmokePayload {
  workflowId: string
  runs: McpRunRecord[]
  status: "completed" | "waiting_approval" | "blocked"
  approval?: { id: string } | null
  blockedRun?: { id: string } | null
  outputs: {
    normalizedTargets?: string[]
    discoveredSubdomains?: string[]
    webEntries?: string[]
    reportDigest?: string[]
  }
}

// ---------------------------------------------------------------------------
// Report export
// ---------------------------------------------------------------------------

export interface ProjectReportExportPayload {
  totalExports: number
  latest?: {
    summary: string
    artifactCount?: number
    keyPoints?: string[]
  } | null
  finalConclusion?: {
    summary: string
    source: string
    keyPoints: string[]
  } | null
}

export interface ProjectReportExportActionPayload {
  dispatch: {
    approval?: { id: string } | null
    run: McpRunRecord
  }
  reportExport: ProjectReportExportPayload
}

// ---------------------------------------------------------------------------
// MCP gateway view types (no Prisma equivalent)
// ---------------------------------------------------------------------------

export interface McpBoundaryRule {
  id: string
  label: string
  title: string
  type: string
  description: string
  enabled: boolean
}

export interface McpCapabilityRecord {
  id: string
  name: string
  description: string
  defaultRiskLevel: string
  defaultApprovalRule: string
  boundary: string
  connectedTools: string[]
}

export interface McpRegistrationField {
  key: string
  label: string
  required: boolean
  description?: string
}

export interface McpServerContractSummaryRecord {
  id: string
  serverId: string
  serverName: string
  version: string
  transport: string
  toolCount: number
  toolNames: string[]
  enabled: boolean
  status: string
  updatedAt: string
}

export interface McpServerInvocationRecord {
  id: string
  serverName: string
  toolName: string
  target: string
  status: string
  summary: string
  durationMs: number
  createdAt: string
}

export interface McpToolContractSummaryRecord {
  id: string
  serverId: string
  toolName: string
  capability: string
  version: string
  status: string
}

// ---------------------------------------------------------------------------
// Settings view types
// ---------------------------------------------------------------------------

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
  value: string | number
  description: string
}

export interface SettingsSectionRecord {
  href: string
  title: string
  description: string
  metric: string
  tone: Tone
}

// ---------------------------------------------------------------------------
// Vuln center
// ---------------------------------------------------------------------------

export interface VulnCenterSummaryPayload {
  total: number
  pendingVerification: number
  bySeverity: Record<string, number>
  findings: Array<{
    id: string
    title: string
    summary: string
    affectedSurface: string
    severity: string
    status: string
    projectName: string
    projectId: string
    evidenceId?: string
    updatedAt?: string
  }>
}

// ---------------------------------------------------------------------------
// Scheduler control (alternative standalone alias)
// ---------------------------------------------------------------------------

export type SchedulerControlRecord = ProjectSchedulerControl
