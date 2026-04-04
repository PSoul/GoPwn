// Re-export Prisma generated types for convenience
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

// Re-export labels
export * from "./labels"

// Orchestrator plan item — LLM output structure
export type OrchestratorPlanItem = {
  capability: string
  requestedAction: string
  target: string
  riskLevel: "low" | "medium" | "high"
  rationale: string
  toolName?: string
  code?: string
  phase?: string
}
