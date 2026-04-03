import { ProxyAgent } from "undici"

import {
  ANALYZER_BRAIN_SYSTEM_PROMPT,
  ORCHESTRATOR_BRAIN_SYSTEM_PROMPT,
  REVIEWER_BRAIN_SYSTEM_PROMPT,
  buildToolAnalysisPrompt,
} from "@/lib/llm/llm-brain-prompt"
import {
  createLlmCallLog,
  appendLlmCallResponse,
  completeLlmCallLog,
  failLlmCallLog,
} from "@/lib/llm/llm-call-logger"
import type { LlmAnalysisResult, LlmProvider } from "@/lib/llm-provider/types"
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
  analyzer?: OpenAiCompatibleProfileConfig
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "")
}

function getProxyDispatcher(): ProxyAgent | undefined {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy
  if (!proxyUrl) return undefined
  return new ProxyAgent(proxyUrl)
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

function safeParseAnalysisContent(content: string): LlmAnalysisResult {
  const parsed = JSON.parse(extractJsonCandidate(content)) as {
    findings?: Array<{ title?: string; severity?: string; detail?: string; target?: string; recommendation?: string }>
    assets?: Array<{ type?: string; value?: string; detail?: string }>
    summary?: string
  }

  return {
    findings: Array.isArray(parsed.findings)
      ? parsed.findings.filter((f) => f.title && f.severity && f.detail).map((f) => ({
          title: f.title!,
          severity: f.severity!,
          detail: f.detail!,
          target: f.target,
          recommendation: f.recommendation,
        }))
      : [],
    assets: Array.isArray(parsed.assets)
      ? parsed.assets.filter((a) => a.type && a.value).map((a) => ({
          type: a.type!,
          value: a.value!,
          detail: a.detail,
        }))
      : [],
    summary: parsed.summary ?? "LLM 分析完成。",
  }
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
  const analyzer = config?.analyzer
  const enabled = isConfiguredProfile(orchestrator)

  return {
    provider: "openai-compatible",
    enabled,
    baseUrl: orchestrator?.baseUrl ?? reviewer?.baseUrl ?? "",
    orchestratorModel: orchestrator?.model ?? "",
    reviewerModel: reviewer?.model ?? orchestrator?.model ?? "",
    analyzerModel: analyzer?.model ?? orchestrator?.model ?? "",
    note: enabled ? "OpenAI-compatible provider 已配置，可用于真实规划请求。" : "OpenAI-compatible provider 未配置，当前仅可使用本地回退策略。",
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

    async analyzeToolOutput(input) {
      const profile = config.analyzer ?? config.orchestrator
      const controller = new AbortController()
      const timeoutMs = Math.min(profile.timeoutMs, 60000) // 分析调用最多 60s
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)
      const startTime = Date.now()

      const callLog = input.projectId
        ? await createLlmCallLog({
            projectId: input.projectId,
            role: "orchestrator",
            phase: "analyzing" as LlmCallPhase,
            prompt: `[分析] ${input.toolName}(${input.target})`,
            model: profile.model,
            provider: "openai-compatible",
          })
        : null

      try {
        const dispatcher = getProxyDispatcher()
        const userPrompt = buildToolAnalysisPrompt(input)

        const response = await fetch(`${normalizeBaseUrl(profile.baseUrl)}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${profile.apiKey}`,
          },
          body: JSON.stringify({
            model: profile.model,
            messages: [
              { role: "system", content: ANALYZER_BRAIN_SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
          }),
          signal: controller.signal,
          ...(dispatcher ? { dispatcher } : {}),
        } as RequestInit)

        if (!response.ok) {
          throw new Error(`LLM analysis request failed with status ${response.status}.`)
        }

        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>
        }
        const content = payload.choices?.[0]?.message?.content ?? ""

        if (!content) {
          throw new Error("LLM analysis returned an empty response.")
        }

        const durationMs = Date.now() - startTime

        if (callLog) {
          await completeLlmCallLog(callLog.id, { response: content, durationMs })
        }

        return safeParseAnalysisContent(content)
      } catch (error) {
        if (callLog) {
          await failLlmCallLog(callLog.id, error instanceof Error ? error.message : "Unknown error")
        }
        throw error
      } finally {
        clearTimeout(timeoutHandle)
      }
    },

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

        const dispatcher = getProxyDispatcher()

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
          ...(dispatcher ? { dispatcher } : {}),
        } as RequestInit)

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
      timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 120000),
      temperature: 0.2,
    },
    reviewer: {
      apiKey: process.env.LLM_API_KEY ?? "",
      baseUrl: process.env.LLM_BASE_URL ?? "",
      model: process.env.LLM_REVIEWER_MODEL ?? process.env.LLM_ORCHESTRATOR_MODEL ?? "",
      timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 120000),
      temperature: 0.1,
    },
    analyzer: {
      apiKey: process.env.LLM_API_KEY ?? "",
      baseUrl: process.env.LLM_BASE_URL ?? "",
      model: process.env.LLM_ANALYZER_MODEL ?? process.env.LLM_ORCHESTRATOR_MODEL ?? "",
      timeoutMs: Math.min(Number(process.env.LLM_TIMEOUT_MS ?? 120000), 60000),
      temperature: 0.1,
    },
  })
}
