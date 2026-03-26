import { buildOpenAiCompatibleStatusFromEnv, createOpenAiCompatibleProvider } from "@/lib/llm-provider/openai-compatible-provider"

export function resolveLlmProvider() {
  const providerName = process.env.LLM_PROVIDER ?? "openai-compatible"
  const apiKey = process.env.LLM_API_KEY
  const baseUrl = process.env.LLM_BASE_URL
  const orchestratorModel = process.env.LLM_ORCHESTRATOR_MODEL
  const reviewerModel = process.env.LLM_REVIEWER_MODEL ?? orchestratorModel ?? ""
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 15000)

  if (
    providerName !== "openai-compatible" ||
    !apiKey ||
    !baseUrl ||
    !orchestratorModel
  ) {
    return null
  }

  return createOpenAiCompatibleProvider({
    apiKey,
    baseUrl,
    orchestratorModel,
    reviewerModel,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 15000,
  })
}

export function getConfiguredLlmProviderStatus() {
  return buildOpenAiCompatibleStatusFromEnv()
}
