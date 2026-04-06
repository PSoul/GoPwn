/**
 * LLM module entry point.
 * Resolves the correct provider based on LlmProfile settings.
 */

import type { LlmProvider } from "./provider"
import { createOpenAIProvider } from "./openai-provider"
import { createLoggedProvider } from "./call-logger"
import { prisma } from "@/lib/infra/prisma"

export type { LlmProvider, LlmMessage, LlmResponse, LlmCallOptions, OpenAIFunctionDef } from "./provider"
export { parseLlmJson } from "./prompts"
export { loadSystemPrompt, invalidatePromptCache } from "./system-prompt"
export {
  buildAnalyzerPrompt,
  buildReviewerPrompt,
  buildVerifierPrompt,
} from "./prompts"
export type {
  LlmAnalysisResult,
  LlmReviewDecision,
  LlmPocCode,
  AnalyzerContext,
  ReviewerContext,
  VerifierContext,
} from "./prompts"

// ReAct prompt
export { buildReactSystemPrompt } from "./react-prompt"
export type { ReactContext } from "./react-prompt"

// ReAct function calling
export {
  mcpToolToFunction,
  mcpToolsToFunctions,
  getControlFunctions,
} from "./function-calling"

// Tool input mapper
export {
  buildToolInput,
  buildToolInputFromFunctionArgs,
} from "./tool-input-mapper"

/**
 * Get a logged LLM provider for a specific role in a project.
 * Reads configuration from the LlmProfile table.
 */
export async function getLlmProvider(
  projectId: string,
  role: "planner" | "analyzer" | "reviewer" | "react",
): Promise<LlmProvider> {
  // react role 复用 planner 的 LLM profile
  const profileId = role === "react" ? "planner" : role
  const profile = await prisma.llmProfile.findUnique({ where: { id: profileId } })

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

  const phaseMap = { planner: "planning", analyzer: "analyzing", reviewer: "reviewing", react: "executing" } as const
  return createLoggedProvider(base, { projectId, role, phase: phaseMap[role] })
}
