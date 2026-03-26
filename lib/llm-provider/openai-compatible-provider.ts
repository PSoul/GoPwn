import type { LlmProvider } from "@/lib/llm-provider/types"
import type { LlmProviderStatus, OrchestratorPlanItem } from "@/lib/prototype-types"

type OpenAiCompatibleConfig = {
  apiKey: string
  baseUrl: string
  orchestratorModel: string
  reviewerModel: string
  timeoutMs: number
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "")
}

function safeParsePlanContent(content: string) {
  const parsed = JSON.parse(content) as {
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

  return "你是授权渗透测试平台的编排模型。请只返回 JSON，包含 summary 和 items。items 数组内每项必须包含 capability、requestedAction、target、riskLevel、rationale。动作必须坚持 LLM=大脑、MCP=四肢 的边界。"
}

function buildStatus(config?: Partial<OpenAiCompatibleConfig>): LlmProviderStatus {
  const enabled = Boolean(config?.apiKey && config?.baseUrl && config?.orchestratorModel)

  return {
    provider: "openai-compatible",
    enabled,
    baseUrl: config?.baseUrl ?? "",
    orchestratorModel: config?.orchestratorModel ?? "",
    reviewerModel: config?.reviewerModel ?? "",
    note: enabled ? "OpenAI-compatible provider 已配置，可用于真实编排请求。" : "OpenAI-compatible provider 未配置，当前仅可使用本地回退策略。",
  }
}

export function createOpenAiCompatibleProvider(config: OpenAiCompatibleConfig): LlmProvider {
  return {
    getStatus: () => buildStatus(config),
    async generatePlan(input) {
      const model = input.purpose === "reviewer" ? config.reviewerModel : config.orchestratorModel
      const controller = new AbortController()
      const timeoutHandle = setTimeout(() => controller.abort(), config.timeoutMs)

      try {
        const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model,
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
            temperature: 0.2,
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
          model,
          content: safeParsePlanContent(content),
        }
      } finally {
        clearTimeout(timeoutHandle)
      }
    },
  }
}

export function buildOpenAiCompatibleStatusFromEnv() {
  return buildStatus({
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL,
    orchestratorModel: process.env.LLM_ORCHESTRATOR_MODEL,
    reviewerModel: process.env.LLM_REVIEWER_MODEL,
  })
}
