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

export type ProjectStatus = "运行中" | "待处理" | "已阻塞" | "已完成"

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

export interface ProjectRecord {
  id: string
  code: string
  name: string
  seed: string
  targetType: string
  targetSummary: string
  owner: string
  priority: "高" | "中" | "低"
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
  authorizationSummary: string
  scopeSummary: string
  forbiddenActions: string
  defaultConcurrency: string
  rateLimit: string
  timeout: string
  approvalMode: string
  tags: string[]
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
}

export interface ProjectFormPreset {
  name: string
  seed: string
  targetType: string
  owner: string
  priority: "高" | "中" | "低"
  targetSummary: string
  authorizationSummary: string
  scopeSummary: string
  forbiddenActions: string
  defaultConcurrency: string
  rateLimit: string
  timeout: string
  approvalMode: string
  tags: string
  deliveryNotes: string
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
}

export interface McpToolRecord {
  id: string
  capability: string
  toolName: string
  version: string
  riskLevel: "高" | "中" | "低"
  status: "启用" | "禁用" | "异常"
  category: string
  defaultConcurrency: string
  rateLimit: string
  timeout: string
  retry: string
  lastCheck: string
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
