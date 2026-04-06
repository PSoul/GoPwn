/**
 * LLM and MCP mock factories for testing.
 */

import type { LlmProvider, LlmMessage, LlmResponse, LlmCallOptions } from "@/lib/llm/provider"

// ─── Delayed LLM Provider (for perf tests) ─────────────

export function createDelayedLlmProvider(options: {
  delayMs: number
  responses: LlmResponse[]
  failRate?: number
}): LlmProvider {
  let callIndex = 0

  return {
    name: "test-delayed",

    async chat(_messages: LlmMessage[], callOptions?: LlmCallOptions): Promise<LlmResponse> {
      // Support abort
      if (callOptions?.signal?.aborted) {
        throw new Error("Aborted")
      }

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, options.delayMs)
        callOptions?.signal?.addEventListener("abort", () => {
          clearTimeout(timer)
          reject(new Error("Aborted"))
        })
      })

      // Random failure
      if (options.failRate && Math.random() < options.failRate) {
        throw new Error("Simulated LLM failure")
      }

      const response = options.responses[Math.min(callIndex, options.responses.length - 1)]
      callIndex++
      return response
    },
  }
}

// ─── Sequential LLM Provider (for unit tests) ──────────

export function createSequentialLlmProvider(responses: LlmResponse[]): LlmProvider {
  let callIndex = 0

  return {
    name: "test-sequential",

    async chat(_messages: LlmMessage[], callOptions?: LlmCallOptions): Promise<LlmResponse> {
      if (callOptions?.signal?.aborted) {
        throw new Error("Aborted")
      }

      const response = responses[Math.min(callIndex, responses.length - 1)]
      callIndex++
      return response
    },
  }
}

// ─── Delayed MCP Tool Mock (for perf tests) ────────────

export function createDelayedMcpTool(options: {
  delayMs: number
  output: string
  failRate?: number
}): (toolName: string, args: Record<string, unknown>) => Promise<{ content: string; isError: boolean }> {
  return async (_toolName, _args) => {
    await new Promise((resolve) => setTimeout(resolve, options.delayMs))

    if (options.failRate && Math.random() < options.failRate) {
      return { content: "Simulated tool failure", isError: true }
    }

    return { content: options.output, isError: false }
  }
}
