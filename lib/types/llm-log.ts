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
  projectName?: string
}

export interface LlmCallLogListPayload {
  items: LlmCallLogRecord[]
  total: number
}
