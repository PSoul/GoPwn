import type { LlmProviderStatus, OrchestratorPlanRecord } from "@/lib/prototype-types"

export interface LlmPlanGenerationInput {
  prompt: string
  purpose: "orchestrator" | "reviewer"
  projectId?: string
}

export interface LlmPlanGenerationResult {
  provider: string
  model: string
  content: Pick<OrchestratorPlanRecord, "items" | "summary">
}

export interface LlmAnalysisInput {
  toolName: string
  target: string
  capability: string
  requestedAction: string
  rawOutput: string
  projectId?: string
}

export interface LlmAnalysisFinding {
  title: string
  severity: string
  detail: string
  target?: string
  recommendation?: string
}

export interface LlmAnalysisAsset {
  type: string
  value: string
  detail?: string
}

export interface LlmAnalysisResult {
  findings: LlmAnalysisFinding[]
  assets: LlmAnalysisAsset[]
  summary: string
}

export interface LlmProvider {
  generatePlan: (input: LlmPlanGenerationInput) => Promise<LlmPlanGenerationResult>
  analyzeToolOutput: (input: LlmAnalysisInput) => Promise<LlmAnalysisResult>
  getStatus: () => LlmProviderStatus
}
