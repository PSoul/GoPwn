import { getStoredLlmProfile } from "@/lib/llm/llm-settings-repository"
import {
  buildOpenAiCompatibleStatus,
  buildOpenAiCompatibleStatusFromEnv,
  createOpenAiCompatibleProvider,
  type OpenAiCompatibleProfileConfig,
} from "@/lib/llm-provider/openai-compatible-provider"

async function buildProfileConfig(profileId: "orchestrator" | "reviewer" | "analyzer") {
  const profile = await getStoredLlmProfile(profileId)

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

export async function resolveLlmProvider() {
  const orchestratorProfile = await buildProfileConfig("orchestrator")
  const reviewerProfile = await buildProfileConfig("reviewer")
  const analyzerProfile = await buildProfileConfig("analyzer")

  if (orchestratorProfile) {
    return createOpenAiCompatibleProvider({
      orchestrator: orchestratorProfile,
      reviewer: reviewerProfile ?? orchestratorProfile,
      analyzer: analyzerProfile ?? orchestratorProfile,
    })
  }

  const providerName = process.env.LLM_PROVIDER ?? "openai-compatible"
  const apiKey = process.env.LLM_API_KEY
  const baseUrl = process.env.LLM_BASE_URL
  const orchestratorModel = process.env.LLM_ORCHESTRATOR_MODEL
  const reviewerModel = process.env.LLM_REVIEWER_MODEL ?? orchestratorModel ?? ""
  const analyzerModel = process.env.LLM_ANALYZER_MODEL ?? orchestratorModel ?? ""
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 120000)

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
      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 120000,
      temperature: 0.2,
    },
    reviewer: {
      apiKey,
      baseUrl,
      model: reviewerModel,
      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 120000,
      temperature: 0.1,
    },
    analyzer: {
      apiKey,
      baseUrl,
      model: analyzerModel,
      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 120000,
      temperature: 0.1,
    },
  })
}

export async function getConfiguredLlmProviderStatus() {
  const orchestratorProfile = await buildProfileConfig("orchestrator")
  const reviewerProfile = await buildProfileConfig("reviewer")
  const analyzerProfile = await buildProfileConfig("analyzer")

  if (orchestratorProfile) {
    return buildOpenAiCompatibleStatus({
      orchestrator: orchestratorProfile,
      reviewer: reviewerProfile ?? orchestratorProfile,
      analyzer: analyzerProfile ?? orchestratorProfile,
    })
  }

  return buildOpenAiCompatibleStatusFromEnv()
}
