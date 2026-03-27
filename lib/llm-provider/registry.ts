import { getStoredLlmProfile } from "@/lib/llm-settings-repository"
import {
  buildOpenAiCompatibleStatus,
  buildOpenAiCompatibleStatusFromEnv,
  createOpenAiCompatibleProvider,
  type OpenAiCompatibleProfileConfig,
} from "@/lib/llm-provider/openai-compatible-provider"

function buildProfileConfig(profileId: "orchestrator" | "reviewer") {
  const profile = getStoredLlmProfile(profileId)

  if (
    !profile ||
    profile.provider !== "openai-compatible" ||
    !profile.enabled ||
    !profile.apiKey ||
    !profile.baseUrl ||
    !profile.model
  ) {
    return null
  }

  const runtimeProfile: OpenAiCompatibleProfileConfig = {
    apiKey: profile.apiKey,
    baseUrl: profile.baseUrl,
    model: profile.model,
    timeoutMs: profile.timeoutMs,
    temperature: profile.temperature,
  }

  return runtimeProfile
}

export function resolveLlmProvider() {
  const orchestratorProfile = buildProfileConfig("orchestrator")
  const reviewerProfile = buildProfileConfig("reviewer")

  if (orchestratorProfile) {
    return createOpenAiCompatibleProvider({
      orchestrator: orchestratorProfile,
      reviewer: reviewerProfile ?? orchestratorProfile,
    })
  }

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
    orchestrator: {
      apiKey,
      baseUrl,
      model: orchestratorModel,
      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 15000,
      temperature: 0.2,
    },
    reviewer: {
      apiKey,
      baseUrl,
      model: reviewerModel,
      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 15000,
      temperature: 0.1,
    },
  })
}

export function getConfiguredLlmProviderStatus() {
  const orchestratorProfile = buildProfileConfig("orchestrator")
  const reviewerProfile = buildProfileConfig("reviewer")

  if (orchestratorProfile) {
    return buildOpenAiCompatibleStatus({
      orchestrator: orchestratorProfile,
      reviewer: reviewerProfile ?? orchestratorProfile,
    })
  }

  return buildOpenAiCompatibleStatusFromEnv()
}
