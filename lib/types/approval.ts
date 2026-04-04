import type { Tone } from "./project"

export interface ApprovalControl {
  enabled: boolean
  mode: string
  autoApproveLowRisk: boolean
  autoApproveMediumRisk: boolean
  description: string
  note: string
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

export interface ApprovalDecisionInput {
  decision: ApprovalRecord["status"]
}

export interface ApprovalControlPatch {
  enabled?: boolean
  autoApproveLowRisk?: boolean
  autoApproveMediumRisk?: boolean
  note?: string
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

export interface ApprovalPolicyPayload {
  overview: ControlSetting[]
  approvalControl: ApprovalControl
  approvalPolicies: PolicyRecord[]
  scopeRules: PolicyRecord[]
}
