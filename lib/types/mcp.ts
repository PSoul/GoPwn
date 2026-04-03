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
  llmCode?: string
  summaryLines: string[]
}

export interface McpToolPatchInput {
  status?: McpToolRecord["status"]
  defaultConcurrency?: string
  rateLimit?: string
  timeout?: string
  retry?: string
  notes?: string
}
