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

export interface LlmProvider {
  generatePlan: (input: LlmPlanGenerationInput) => Promise<LlmPlanGenerationResult>
  getStatus: () => LlmProviderStatus
}
