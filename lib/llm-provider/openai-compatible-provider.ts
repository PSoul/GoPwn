import {
  ORCHESTRATOR_BRAIN_SYSTEM_PROMPT,
  REVIEWER_BRAIN_SYSTEM_PROMPT,
} from "@/lib/llm-brain-prompt"
import {
  createLlmCallLog,
  appendLlmCallResponse,
  completeLlmCallLog,
  failLlmCallLog,
} from "@/lib/llm-call-logger"
import type { LlmProvider } from "@/lib/llm-provider/types"
import type { LlmCallPhase, LlmCallRole, LlmProviderStatus, OrchestratorPlanItem } from "@/lib/prototype-types"

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
    return REVIEWER_BRAIN_SYSTEM_PROMPT
  }

  return ORCHESTRATOR_BRAIN_SYSTEM_PROMPT
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

function mapPurposeToRole(purpose: "orchestrator" | "reviewer"): LlmCallRole {
  return purpose
}

function mapPurposeToPhase(purpose: "orchestrator" | "reviewer"): LlmCallPhase {
  return purpose === "reviewer" ? "reviewing" : "planning"
}

export function createOpenAiCompatibleProvider(config: OpenAiCompatibleConfig): LlmProvider {
  return {
    getStatus: () => buildOpenAiCompatibleStatus(config),
    async generatePlan(input) {
      const profile = input.purpose === "reviewer" ? config.reviewer ?? config.orchestrator : config.orchestrator
      const controller = new AbortController()
      const timeoutHandle = setTimeout(() => controller.abort(), profile.timeoutMs)
      const startTime = Date.now()

      // Create LLM call log for tracking
      const callLog = input.projectId
        ? await createLlmCallLog({
            projectId: input.projectId,
            role: mapPurposeToRole(input.purpose),
            phase: mapPurposeToPhase(input.purpose),
            prompt: input.prompt,
            model: profile.model,
            provider: "openai-compatible",
          })
        : null

      try {
        const useStreaming = Boolean(input.projectId)

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
            ...(useStreaming ? { stream: true } : {}),
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`LLM provider request failed with status ${response.status}.`)
        }

        let content: string

        if (useStreaming && response.body) {
          // Streaming mode: read chunks and log incrementally
          content = ""
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let lastFlush = Date.now()

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const text = decoder.decode(value, { stream: true })
            const lines = text.split("\n")

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue
              const data = line.slice(6).trim()
              if (data === "[DONE]") continue

              try {
                const chunk = JSON.parse(data) as {
                  choices?: Array<{ delta?: { content?: string } }>
                }
                const delta = chunk.choices?.[0]?.delta?.content
                if (delta) {
                  content += delta
                  // Flush to DB every ~500ms
                  if (callLog && Date.now() - lastFlush > 500) {
                    await appendLlmCallResponse(callLog.id, content.slice(callLog.response.length))
                    lastFlush = Date.now()
                  }
                }
              } catch {
                // Skip malformed SSE chunks
              }
            }
          }
        } else {
          // Non-streaming mode
          const payload = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>
          }
          content = payload.choices?.[0]?.message?.content ?? ""
        }

        if (!content) {
          throw new Error("LLM provider returned an empty assistant message.")
        }

        const durationMs = Date.now() - startTime

        // Complete the log
        if (callLog) {
          await completeLlmCallLog(callLog.id, {
            response: content,
            durationMs,
          })
        }

        return {
          provider: "openai-compatible",
          model: profile.model,
          content: safeParsePlanContent(content),
        }
      } catch (error) {
        if (callLog) {
          await failLlmCallLog(callLog.id, error instanceof Error ? error.message : "Unknown error")
        }
        throw error
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
