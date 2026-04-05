/**
 * ReAct loop context manager.
 * Maintains the message list for iterative LLM calls with sliding-window
 * compression to stay within token budgets.
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
  /** Index of the assistant message that preceded this result. */
  assistantMsgIdx: number
  /** Index of the function-result message. */
  functionMsgIdx: number
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
   * Append an assistant message. If the assistant is requesting a function
   * call, include the function_call field (content should be null in that case
   * per OpenAI spec).
   */
  addAssistantMessage(
    content: string | null,
    functionCall?: { name: string; arguments: string },
  ): void {
    const msg: LlmMessage = { role: "assistant", content }
    if (functionCall) {
      msg.function_call = functionCall
    }
    this.messages.push(msg)
  }

  /**
   * Record a tool result as a function-role message and optionally compress
   * older steps to stay within the token budget.
   */
  addToolResult(step: {
    stepIndex: number
    toolName: string
    target: string
    functionName: string
    output: string
    status: string
    thought?: string
  }): void {
    const assistantMsgIdx = this.messages.length - 1 // last msg should be assistant

    // Truncate individual output to cap size
    const truncatedOutput = truncate(step.output, MAX_OUTPUT_CHARS)

    const functionMsg: LlmMessage = {
      role: "function",
      name: step.functionName,
      content: truncatedOutput,
    }
    this.messages.push(functionMsg)

    const functionMsgIdx = this.messages.length - 1

    this.steps.push({
      ...step,
      output: truncatedOutput,
      assistantMsgIdx,
      functionMsgIdx,
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
      const statusTag = s.status === "success" ? "OK" : s.status.toUpperCase()
      return `[Step ${s.stepIndex}] ${s.toolName} → ${s.target} (${statusTag})`
    })

    // Collect the message indices that belong to compressed steps (to remove)
    const indicesToRemove = new Set<number>()
    for (const s of stepsToCompress) {
      indicesToRemove.add(s.assistantMsgIdx)
      indicesToRemove.add(s.functionMsgIdx)
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
    // Recompute indices by scanning newMessages
    for (const step of recentSteps) {
      // Find the function message for this step by matching role + name + content
      for (let i = 0; i < newMessages.length; i++) {
        const m = newMessages[i]
        if (
          m.role === "function" &&
          m.name === step.functionName &&
          m.content === step.output
        ) {
          step.functionMsgIdx = i
          step.assistantMsgIdx = i - 1
          break
        }
      }
    }

    this.messages = newMessages
    this.steps = recentSteps
  }
}
