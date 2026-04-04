import type { ApprovalControl } from "./approval"

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

export type ProjectStatus = "运行中" | "待启动" | "已暂停" | "已停止" | "等待审批" | "已完成"

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
  severity: "高危" | "中危" | "低危" | "信息"
  status: "待验证" | "已确认" | "待复核" | "已缓解"
  title: string
  summary: string
  affectedSurface: string
  evidenceId: string
  owner: string
  createdAt: string
  updatedAt: string
  rawInput?: string
  rawOutput: string[]
  screenshotPath?: string
  htmlArtifactPath?: string
  capturedUrl?: string
  remediationNote?: string
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
