import type {
  ProjectLifecycle,
  PentestPhase,
  FindingStatus,
  Severity,
  RiskLevel,
  ApprovalStatus,
  McpRunStatus,
  AssetKind,
} from "@/lib/generated/prisma"

export const LIFECYCLE_LABELS: Record<ProjectLifecycle, string> = {
  idle: "待启动",
  planning: "规划中",
  executing: "执行中",
  waiting_approval: "等待审批",
  reviewing: "回顾中",
  settling: "收尾中",
  stopping: "停止中",
  stopped: "已停止",
  completed: "已完成",
  failed: "失败",
}

export const PHASE_LABELS: Record<PentestPhase, string> = {
  recon: "信息收集",
  discovery: "攻击面发现",
  assessment: "漏洞评估",
  verification: "漏洞验证",
  reporting: "报告生成",
}

export const FINDING_STATUS_LABELS: Record<FindingStatus, string> = {
  suspected: "疑似",
  verifying: "验证中",
  verified: "已确认",
  false_positive: "误报",
  remediated: "已修复",
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "严重",
  high: "高危",
  medium: "中危",
  low: "低危",
  info: "信息",
}

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: "低",
  medium: "中",
  high: "高",
}

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending: "待处理",
  approved: "已批准",
  rejected: "已拒绝",
  deferred: "已延后",
}

export const MCP_RUN_STATUS_LABELS: Record<McpRunStatus, string> = {
  pending: "待执行",
  scheduled: "已排队",
  running: "执行中",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已取消",
}

export const STOP_REASON_LABELS: Record<string, string> = {
  llm_done: "LLM 主动停止",
  llm_no_action: "LLM 结束推理",
  max_steps: "达到步数上限",
  aborted: "用户中止",
  error: "执行错误",
}

export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
  domain: "域名",
  subdomain: "子域名",
  ip: "IP 地址",
  port: "端口",
  service: "服务",
  webapp: "Web 应用",
  api_endpoint: "API 端点",
}
