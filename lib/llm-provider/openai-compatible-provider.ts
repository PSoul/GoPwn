import type { LlmProvider } from "@/lib/llm-provider/types"
import type { LlmProviderStatus, OrchestratorPlanItem } from "@/lib/prototype-types"

export type OpenAiCompatibleProfileConfig = {
  apiKey: string
  baseUrl: string
  model: string
  timeoutMs: number
  temperature: number
}

type OpenAiCompatibleConfig = {
  orchestrator: OpenAiCompatibleProfileConfig
  reviewer?: OpenAiCompatibleProfileConfig
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "")
}

function extractJsonCandidate(content: string) {
  const trimmed = content.trim()
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim()
  }

  const firstBraceIndex = trimmed.indexOf("{")
  const lastBraceIndex = trimmed.lastIndexOf("}")

  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    return trimmed.slice(firstBraceIndex, lastBraceIndex + 1)
  }

  return trimmed
}

function safeParsePlanContent(content: string) {
  const parsed = JSON.parse(extractJsonCandidate(content)) as {
    items?: OrchestratorPlanItem[]
    summary?: string
  }

  return {
    items: Array.isArray(parsed.items) ? parsed.items : [],
    summary: parsed.summary ?? "LLM 已返回计划，但未附带摘要。",
  }
}

function getSystemPrompt(purpose: "orchestrator" | "reviewer") {
  if (purpose === "reviewer") {
    return "你是授权渗透测试平台的结果审阅模型。请只返回 JSON，包含 summary 和 items。items 数组内每项必须包含 capability、requestedAction、target、riskLevel、rationale。"
  }

  return "你是授权渗透测试平台的编排模型。请只返回 JSON，包含 summary 和 items。items 数组内每项必须包含 capability、requestedAction、target、riskLevel、rationale。capability 只允许使用 目标解析类、Web 页面探测类、受控验证类 这三个值。riskLevel 只允许使用 高、中、低。动作必须坚持 LLM=大脑、MCP=四肢 的边界。"
}

function isConfiguredProfile(config?: Partial<OpenAiCompatibleProfileConfig>) {
  return Boolean(config?.apiKey && config?.baseUrl && config?.model)
}

export function buildOpenAiCompatibleStatus(config?: Partial<OpenAiCompatibleConfig>): LlmProviderStatus {
  const orchestrator = config?.orchestrator
  const reviewer = config?.reviewer
  const enabled = isConfiguredProfile(orchestrator)

  return {
    provider: "openai-compatible",
    enabled,
    baseUrl: orchestrator?.baseUrl ?? reviewer?.baseUrl ?? "",
    orchestratorModel: orchestrator?.model ?? "",
    reviewerModel: reviewer?.model ?? orchestrator?.model ?? "",
    note: enabled ? "OpenAI-compatible provider 已配置，可用于真实编排请求。" : "OpenAI-compatible provider 未配置，当前仅可使用本地回退策略。",
  }
}

export function createOpenAiCompatibleProvider(config: OpenAiCompatibleConfig): LlmProvider {
  return {
    getStatus: () => buildOpenAiCompatibleStatus(config),
    async generatePlan(input) {
      const profile = input.purpose === "reviewer" ? config.reviewer ?? config.orchestrator : config.orchestrator
      const controller = new AbortController()
      const timeoutHandle = setTimeout(() => controller.abort(), profile.timeoutMs)

      try {
        const response = await fetch(`${normalizeBaseUrl(profile.baseUrl)}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${profile.apiKey}`,
          },
          body: JSON.stringify({
            model: profile.model,
            messages: [
              {
                role: "system",
                content: getSystemPrompt(input.purpose),
              },
              {
                role: "user",
                content: input.prompt,
              },
            ],
            response_format: {
              type: "json_object",
            },
            temperature: profile.temperature,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`LLM provider request failed with status ${response.status}.`)
        }

        const payload = (await response.json()) as {
          choices?: Array<{
            message?: {
              content?: string
            }
          }>
        }
        const content = payload.choices?.[0]?.message?.content

        if (!content) {
          throw new Error("LLM provider returned an empty assistant message.")
        }

        return {
          provider: "openai-compatible",
          model: profile.model,
          content: safeParsePlanContent(content),
        }
      } finally {
        clearTimeout(timeoutHandle)
      }
    },
  }
}

export function buildOpenAiCompatibleStatusFromEnv() {
  return buildOpenAiCompatibleStatus({
    orchestrator: {
      apiKey: process.env.LLM_API_KEY ?? "",
      baseUrl: process.env.LLM_BASE_URL ?? "",
      model: process.env.LLM_ORCHESTRATOR_MODEL ?? "",
      timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 15000),
      temperature: 0.2,
    },
    reviewer: {
      apiKey: process.env.LLM_API_KEY ?? "",
      baseUrl: process.env.LLM_BASE_URL ?? "",
      model: process.env.LLM_REVIEWER_MODEL ?? process.env.LLM_ORCHESTRATOR_MODEL ?? "",
      timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 15000),
      temperature: 0.1,
    },
  })
}
