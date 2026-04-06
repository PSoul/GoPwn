/**
 * ReAct loop context manager.
 * Maintains the message list for iterative LLM calls with sliding-window
 * compression to stay within token budgets.
 *
 * Uses the modern OpenAI `tools` message format (role:"tool" + tool_call_id).
 */

import type { LlmMessage } from "@/lib/llm/provider"

/** Keep the last N steps with full output. */
const RECENT_WINDOW = 5

/** Max characters for a single tool output before truncation. */
const MAX_OUTPUT_CHARS = 3000

/** Estimated token budget — trigger compression above this. */
const TOKEN_BUDGET = 80000

/** Rough token estimate: 1 token ≈ 3 characters. */
function estimateTokens(messages: LlmMessage[]): number {
  let chars = 0
  for (const m of messages) {
    if (m.content) chars += m.content.length
    if (m.function_call) {
      chars += m.function_call.name.length + m.function_call.arguments.length
    }
    if (m.tool_calls) {
      for (const tc of m.tool_calls) {
        chars += tc.function.name.length + tc.function.arguments.length
      }
    }
    if (m.name) chars += m.name.length
  }
  return Math.ceil(chars / 3)
}

/** Truncate a string to maxLen, appending a marker if truncated. */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + "\n...[truncated]"
}

/**
 * One recorded tool-execution step, used for compression bookkeeping.
 */
interface ToolStep {
  stepIndex: number
  toolName: string
  target: string
  functionName: string
  output: string
  status: string
  thought?: string
  toolCallId: string
  /** Index of the assistant message that preceded this result. */
  assistantMsgIdx: number
  /** Index of the tool-result message. */
  toolMsgIdx: number
}

/** Auto-incrementing tool_call ID generator for context coherence. */
let toolCallCounter = 0
export function generateToolCallId(): string {
  return `call_${Date.now()}_${++toolCallCounter}`
}

export class ReactContextManager {
  private messages: LlmMessage[] = []
  private steps: ToolStep[] = []

  constructor(systemPrompt: string, initialUserMessage: string) {
    this.messages.push({ role: "system", content: systemPrompt })
    this.messages.push({ role: "user", content: initialUserMessage })
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Return the current message list ready to pass to the LLM. */
  getMessages(): LlmMessage[] {
    return [...this.messages]
  }

  /** Replace the system prompt (index 0). */
  updateSystemPrompt(newPrompt: string): void {
    this.messages[0] = { role: "system", content: newPrompt }
  }

  /**
   * Append an assistant message with a tool_calls request.
   * Uses the modern `tools` format: assistant message has `tool_calls` array.
   */
  addAssistantMessage(
    content: string | null,
    functionCall?: { name: string; arguments: string },
    toolCallId?: string,
  ): void {
    const msg: LlmMessage = { role: "assistant", content }
    if (functionCall && toolCallId) {
      // Modern format: tool_calls array on assistant message
      msg.tool_calls = [{
        id: toolCallId,
        type: "function",
        function: {
          name: functionCall.name,
          arguments: functionCall.arguments,
        },
      }]
    } else if (functionCall) {
      // Fallback: generate a tool_call_id if none provided
      const id = generateToolCallId()
      msg.tool_calls = [{
        id,
        type: "function",
        function: {
          name: functionCall.name,
          arguments: functionCall.arguments,
        },
      }]
    }
    this.messages.push(msg)
  }

  /**
   * Record a tool result using the modern `role: "tool"` format with `tool_call_id`.
   * Optionally compress older steps to stay within the token budget.
   */
  addToolResult(step: {
    stepIndex: number
    toolName: string
    target: string
    functionName: string
    output: string
    status: string
    thought?: string
    toolCallId?: string
  }): void {
    const assistantMsgIdx = this.messages.length - 1 // last msg should be assistant

    // Truncate individual output to cap size
    const truncatedOutput = truncate(step.output, MAX_OUTPUT_CHARS)

    // Resolve tool_call_id: use provided, or extract from assistant message's tool_calls
    let toolCallId = step.toolCallId ?? ""
    if (!toolCallId) {
      const lastMsg = this.messages[assistantMsgIdx]
      if (lastMsg?.tool_calls?.[0]) {
        toolCallId = lastMsg.tool_calls[0].id
      } else {
        toolCallId = generateToolCallId()
      }
    }

    // Modern format: role: "tool" with tool_call_id
    const toolMsg: LlmMessage = {
      role: "tool",
      content: truncatedOutput,
      tool_call_id: toolCallId,
    }
    this.messages.push(toolMsg)

    const toolMsgIdx = this.messages.length - 1

    this.steps.push({
      ...step,
      output: truncatedOutput,
      toolCallId,
      assistantMsgIdx,
      toolMsgIdx,
    })

    // Check if compression is needed
    if (estimateTokens(this.messages) > TOKEN_BUDGET) {
      this.compress()
    }
  }

  // ---------------------------------------------------------------------------
  // Compression
  // ---------------------------------------------------------------------------

  /**
   * Sliding-window compression: keep the most recent RECENT_WINDOW steps with
   * full output; collapse earlier steps into one-line summaries.
   */
  private compress(): void {
    if (this.steps.length <= RECENT_WINDOW) return

    const stepsToCompress = this.steps.slice(0, this.steps.length - RECENT_WINDOW)

    // Build summary lines for old steps
    const summaryLines: string[] = stepsToCompress.map((s) => {
      const statusTag = s.status === "succeeded" ? "OK" : s.status.toUpperCase()
      return `[Step ${s.stepIndex}] ${s.toolName} → ${s.target} (${statusTag})`
    })

    // Collect the message indices that belong to compressed steps (to remove)
    const indicesToRemove = new Set<number>()
    for (const s of stepsToCompress) {
      indicesToRemove.add(s.assistantMsgIdx)
      indicesToRemove.add(s.toolMsgIdx)
    }

    // Never remove the system prompt (0) or initial user message (1)
    indicesToRemove.delete(0)
    indicesToRemove.delete(1)

    // Rebuild messages: system, user, compressed summary, then remaining msgs
    const newMessages: LlmMessage[] = []

    // Keep system + user
    newMessages.push(this.messages[0]) // system
    newMessages.push(this.messages[1]) // initial user

    // Insert compressed summary as a user message
    if (summaryLines.length > 0) {
      newMessages.push({
        role: "user",
        content: `[Previous steps summary]\n${summaryLines.join("\n")}`,
      })
    }

    // Append all messages that are NOT in the removal set and not system/user
    for (let i = 2; i < this.messages.length; i++) {
      if (!indicesToRemove.has(i)) {
        newMessages.push(this.messages[i])
      }
    }

    // Update step indices to reflect new message positions
    const recentSteps = this.steps.slice(this.steps.length - RECENT_WINDOW)
    for (const step of recentSteps) {
      for (let i = 0; i < newMessages.length; i++) {
        const m = newMessages[i]
        if (
          m.role === "tool" &&
          m.tool_call_id === step.toolCallId &&
          m.content === step.output
        ) {
          step.toolMsgIdx = i
          // Find the actual assistant message that contains this tool_call_id
          let assistantIdx = i - 1
          for (let j = i - 1; j >= 0; j--) {
            if (newMessages[j].role === "assistant" && newMessages[j].tool_calls?.some((tc) => tc.id === step.toolCallId)) {
              assistantIdx = j
              break
            }
          }
          step.assistantMsgIdx = assistantIdx
          break
        }
      }
    }

    this.messages = newMessages
    this.steps = recentSteps
  }
}
