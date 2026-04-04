/**
 * OpenAI-compatible LLM provider.
 * Works with OpenAI, Azure OpenAI, vLLM, Ollama, and any OpenAI-compatible API.
 */

import type { LlmProvider, LlmMessage, LlmResponse, LlmCallOptions } from "./provider"

type OpenAIConfig = {
  apiKey: string
  baseUrl: string
  model: string
  defaultTemperature?: number
  defaultTimeoutMs?: number
}

export function createOpenAIProvider(config: OpenAIConfig): LlmProvider {
  const { apiKey, baseUrl, model, defaultTemperature = 0.2, defaultTimeoutMs = 120_000 } = config

  return {
    name: "openai-compatible",

    async chat(messages: LlmMessage[], options?: LlmCallOptions): Promise<LlmResponse> {
      const url = `${baseUrl.replace(/\/+$/, "")}/v1/chat/completions`
      const temperature = options?.temperature ?? defaultTemperature
      const timeoutMs = options?.timeoutMs ?? defaultTimeoutMs

      const body: Record<string, unknown> = {
        model,
        messages,
        temperature,
        max_tokens: options?.maxTokens ?? 4096,
      }

      if (options?.jsonMode) {
        body.response_format = { type: "json_object" }
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      const start = Date.now()
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        if (!res.ok) {
          const text = await res.text().catch(() => "")
          throw new Error(`LLM API error ${res.status}: ${text.slice(0, 500)}`)
        }

        const data = (await res.json()) as {
          choices: Array<{ message: { content: string } }>
          model: string
          usage?: { prompt_tokens?: number; completion_tokens?: number }
        }

        const content = data.choices?.[0]?.message?.content ?? ""
        const durationMs = Date.now() - start

        return {
          content,
          model: data.model ?? model,
          provider: "openai-compatible",
          inputTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
          durationMs,
        }
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
