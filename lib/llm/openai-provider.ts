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
      const cleanBase = baseUrl.replace(/\/+$/, "")
      const url = cleanBase.endsWith("/v1")
        ? `${cleanBase}/chat/completions`
        : `${cleanBase}/v1/chat/completions`
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

      if (options?.functions) {
        body.functions = options.functions
      }
      if (options?.function_call) {
        body.function_call = options.function_call
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      // If an external signal is provided, abort our controller when it fires
      if (options?.signal) {
        if (options.signal.aborted) {
          clearTimeout(timer)
          throw new Error("LLM call aborted: project stopped")
        }
        options.signal.addEventListener("abort", () => controller.abort(), { once: true })
      }

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
          choices: Array<{
            message: {
              content: string | null
              function_call?: { name: string; arguments: string }
            }
          }>
          model: string
          usage?: { prompt_tokens?: number; completion_tokens?: number }
        }

        const message = data.choices?.[0]?.message
        const content = message?.content ?? ""
        const durationMs = Date.now() - start

        const result: LlmResponse = {
          content,
          model: data.model ?? model,
          provider: "openai-compatible",
          inputTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
          durationMs,
        }

        if (message?.function_call) {
          result.functionCall = {
            name: message.function_call.name,
            arguments: message.function_call.arguments,
          }
        }

        return result
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
