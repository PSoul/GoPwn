/**
 * LLM provider abstraction layer.
 * All LLM calls go through this interface so we can swap providers.
 */

export type LlmMessage = {
  role: "system" | "user" | "assistant" | "function" | "tool"
  content: string | null
  name?: string
  /** Legacy function_call format (deprecated by OpenAI) */
  function_call?: {
    name: string
    arguments: string
  }
  /** Modern tool_calls format */
  tool_calls?: Array<{
    id: string
    type: "function"
    function: { name: string; arguments: string }
  }>
  /** For role:"tool" messages — references the tool_call id */
  tool_call_id?: string
}

export type LlmResponse = {
  content: string
  model: string
  provider: string
  inputTokens?: number
  outputTokens?: number
  durationMs: number
  functionCall?: {
    name: string
    arguments: string
  }
  /** The tool_call ID from the modern tools API response */
  toolCallId?: string
}

export type OpenAIFunctionDef = {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export type LlmCallOptions = {
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
  jsonMode?: boolean
  signal?: AbortSignal
  functions?: OpenAIFunctionDef[]
  function_call?: "auto" | "none" | { name: string }
}

export interface LlmProvider {
  readonly name: string
  chat(messages: LlmMessage[], options?: LlmCallOptions): Promise<LlmResponse>
}
