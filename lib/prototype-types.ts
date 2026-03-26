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
  tone: "neutral" | "info" | "success" | "warning" | "danger"
}

export interface ProjectRecord {
  id: string
  name: string
  seed: string
  targetType: string
  stage: ProjectStage
  status: ProjectStatus
  pendingApprovals: number
  lastUpdated: string
  riskSummary: string
}

export interface TimelineStage {
  title: ProjectStage
  state: "done" | "current" | "blocked" | "watching"
  note: string
}

export interface TaskRecord {
  id: string
  title: string
  status: TaskStatus
  reason: string
  priority: "P1" | "P2" | "P3"
}

export interface ApprovalRecord {
  id: string
  projectName: string
  target: string
  actionType: string
  riskLevel: "高" | "中" | "低"
  rationale: string
  impact: string
  mcpCapability: string
  tool: string
  status: "待处理" | "已批准" | "已拒绝" | "已延后"
}

export interface AssetRecord {
  id: string
  projectName: string
  type: string
  label: string
  profile: string
  scopeStatus: "已纳入" | "待确认" | "待复核"
  lastSeen: string
}

export interface EvidenceRecord {
  id: string
  projectName: string
  title: string
  source: string
  confidence: string
  conclusion: string
  linkedApprovalId: string
}

export interface McpToolRecord {
  id: string
  capability: string
  toolName: string
  version: string
  riskLevel: "高" | "中" | "低"
  status: "启用" | "禁用" | "异常"
}
