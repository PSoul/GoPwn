import type { ProjectSchedulerLifecycle } from "./project"

export interface ProjectSchedulerControl {
  lifecycle: ProjectSchedulerLifecycle
  paused: boolean
  autoReplan: boolean
  maxRounds: number
  currentRound: number
  note: string
  updatedAt: string
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
  /** 轮间自我反思（由 LLM 或规则引擎生成） */
  reflection?: {
    /** 本轮最重要的发现 */
    keyFindings: string
    /** 失败分析和教训 */
    lessonsLearned: string
    /** 下一轮建议方向 */
    nextDirection: string
  }
}
