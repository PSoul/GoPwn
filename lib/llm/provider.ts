/**
 * LLM provider abstraction layer.
 * All LLM calls go through this interface so we can swap providers.
 */

export type LlmMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

export type LlmResponse = {
  content: string
  model: string
  provider: string
  inputTokens?: number
  outputTokens?: number
  durationMs: number
}

export type LlmCallOptions = {
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
  jsonMode?: boolean
}

export interface LlmProvider {
  readonly name: string
  chat(messages: LlmMessage[], options?: LlmCallOptions): Promise<LlmResponse>
}
