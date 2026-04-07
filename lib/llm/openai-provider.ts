/**
 * OpenAI-compatible LLM provider.
 * Works with OpenAI, Azure OpenAI, vLLM, Ollama, and any OpenAI-compatible API.
 *
 * Supports both legacy `functions` format and modern `tools` format.
 * Sends requests using the modern `tools` format; parses responses from both.
 *
 * 使用 SSE 流式请求以兼容部分 API 代理（非流式模式可能返回空内容）。
 */

import type { LlmProvider, LlmMessage, LlmResponse, LlmCallOptions } from "./provider"

type OpenAIConfig = {
  apiKey: string
  baseUrl: string
  model: string
  defaultTemperature?: number
  defaultTimeoutMs?: number
}

/** 从 SSE 流中聚合完整响应 */
async function consumeStream(res: Response): Promise<{
  content: string
  reasoningContent: string
  toolCalls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>
  model: string
  usage: { prompt_tokens?: number; completion_tokens?: number }
}> {
  const reader = res.body?.getReader()
  if (!reader) throw new Error("SSE 流不可用: response body 为空")

  const decoder = new TextDecoder()
  let content = ""
  let reasoningContent = ""
  // tool_calls 按 index 聚合（流式 delta 分块发送 name 和 arguments）
  const toolCallMap = new Map<number, { id: string; type: "function"; function: { name: string; arguments: string } }>()
  let modelName = ""
  let usage: { prompt_tokens?: number; completion_tokens?: number } = {}
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      // 保留最后一行（可能不完整）
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const data = line.slice(6).trim()
        if (data === "[DONE]") continue

        try {
          const parsed = JSON.parse(data)
          if (parsed.model) modelName = parsed.model
          if (parsed.usage) usage = parsed.usage

          const delta = parsed.choices?.[0]?.delta
          if (!delta) continue

          if (delta.content) content += delta.content
          if (delta.reasoning_content) reasoningContent += delta.reasoning_content

          // 聚合流式 tool_calls
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0
              const existing = toolCallMap.get(idx)
              if (!existing) {
                toolCallMap.set(idx, {
                  id: tc.id ?? "",
                  type: "function",
                  function: { name: tc.function?.name ?? "", arguments: tc.function?.arguments ?? "" },
                })
              } else {
                if (tc.id) existing.id = tc.id
                if (tc.function?.name) existing.function.name += tc.function.name
                if (tc.function?.arguments) existing.function.arguments += tc.function.arguments
              }
            }
          }
        } catch {
          // 忽略非 JSON 行
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  // 按 index 排序输出
  const toolCalls = [...toolCallMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, v]) => v)

  return { content, reasoningContent, toolCalls, model: modelName, usage }
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
        stream: true,
        stream_options: { include_usage: true },
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

        const streamed = await consumeStream(res)
        const durationMs = Date.now() - start

        // 优先用 content，fallback 到 reasoning_content（部分推理模型只返回后者）
        const content = streamed.content || streamed.reasoningContent || ""

        // 检测空响应：content 和 tool_calls 都为空
        const hasToolCalls = streamed.toolCalls.length > 0
        if (!content && !hasToolCalls) {
          throw new Error(
            `LLM 返回空响应: content=null, tool_calls=null (model=${streamed.model || model})。` +
            `可能是 API 提供商或模型异常，请检查模型配置。`,
          )
        }

        const result: LlmResponse = {
          content,
          model: streamed.model || model,
          provider: "openai-compatible",
          inputTokens: streamed.usage?.prompt_tokens,
          outputTokens: streamed.usage?.completion_tokens,
          durationMs,
        }

        // Parse function call from streamed tool_calls
        if (hasToolCalls) {
          const tc = streamed.toolCalls[0]
          result.functionCall = {
            name: tc.function.name,
            arguments: tc.function.arguments,
          }
          result.toolCallId = tc.id
        }

        return result
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
