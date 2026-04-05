/**
 * OpenAI-compatible LLM provider.
 * Works with OpenAI, Azure OpenAI, vLLM, Ollama, and any OpenAI-compatible API.
 *
 * Supports both legacy `functions` format and modern `tools` format.
 * Sends requests using the modern `tools` format; parses responses from both.
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

      // Convert functions to modern `tools` format
      if (options?.functions && options.functions.length > 0) {
        body.tools = options.functions.map((fn) => ({
          type: "function",
          function: {
            name: fn.name,
            description: fn.description,
            parameters: fn.parameters,
          },
        }))

        // Map function_call option to tool_choice
        if (options?.function_call) {
          if (options.function_call === "auto") {
            body.tool_choice = "auto"
          } else if (options.function_call === "none") {
            body.tool_choice = "none"
          } else if (typeof options.function_call === "object" && "name" in options.function_call) {
            body.tool_choice = {
              type: "function",
              function: { name: options.function_call.name },
            }
          }
        }
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
              /** Legacy format */
              function_call?: { name: string; arguments: string }
              /** Modern format */
              tool_calls?: Array<{
                id: string
                type: "function"
                function: { name: string; arguments: string }
              }>
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

        // Parse function call from response — try modern format first, fall back to legacy
        if (message?.tool_calls && message.tool_calls.length > 0) {
          const tc = message.tool_calls[0]
          result.functionCall = {
            name: tc.function.name,
            arguments: tc.function.arguments,
          }
          result.toolCallId = tc.id
        } else if (message?.function_call) {
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
