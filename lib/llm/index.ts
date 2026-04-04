/**
 * LLM module entry point.
 * Resolves the correct provider based on LlmProfile settings.
 */

import type { LlmProvider } from "./provider"
import { createOpenAIProvider } from "./openai-provider"
import { createLoggedProvider } from "./call-logger"
import { prisma } from "@/lib/infra/prisma"

export type { LlmProvider, LlmMessage, LlmResponse, LlmCallOptions } from "./provider"
export { parseLlmJson } from "./prompts"
export {
  buildPlannerPrompt,
  buildAnalyzerPrompt,
  buildReviewerPrompt,
  buildVerifierPrompt,
} from "./prompts"
export type {
  LlmPlanResponse,
  LlmAnalysisResult,
  LlmReviewDecision,
  LlmPocCode,
  PlannerContext,
  AnalyzerContext,
  ReviewerContext,
  VerifierContext,
} from "./prompts"

/**
 * Get a logged LLM provider for a specific role in a project.
 * Reads configuration from the LlmProfile table.
 */
export async function getLlmProvider(
  projectId: string,
  role: "planner" | "analyzer" | "reviewer",
): Promise<LlmProvider> {
  const profile = await prisma.llmProfile.findUnique({ where: { id: role } })

  if (!profile || !profile.baseUrl || !profile.model) {
    throw new Error(
      `LLM profile "${role}" is not configured. Please set up the LLM provider in Settings.`,
    )
  }

  const base = createOpenAIProvider({
    apiKey: profile.apiKey,
    baseUrl: profile.baseUrl,
    model: profile.model,
    defaultTemperature: profile.temperature,
    defaultTimeoutMs: profile.timeoutMs,
  })

  const phaseMap = { planner: "planning", analyzer: "analyzing", reviewer: "reviewing" } as const
  return createLoggedProvider(base, { projectId, role, phase: phaseMap[role] })
}
