/**
 * LLM call logger — wraps any LlmProvider to automatically log calls to database.
 */

import type { LlmProvider, LlmMessage, LlmResponse, LlmCallOptions } from "./provider"
import * as llmLogRepo from "@/lib/repositories/llm-log-repo"
import { publishEvent } from "@/lib/infra/event-bus"

type LogContext = {
  projectId: string
  role: string   // planner | analyzer | reviewer
  phase: string  // planning | analyzing | verifying | reviewing
}

export function createLoggedProvider(provider: LlmProvider, ctx: LogContext): LlmProvider {
  return {
    name: provider.name,

    async chat(messages: LlmMessage[], options?: LlmCallOptions): Promise<LlmResponse> {
      const prompt = messages.map((m) => `[${m.role}] ${m.content ?? ""}`).join("\n---\n")

      const log = await llmLogRepo.create({
        projectId: ctx.projectId,
        role: ctx.role,
        phase: ctx.phase,
        prompt: prompt.slice(0, 50_000), // cap storage size
        model: "",
        provider: provider.name,
      })

      await publishEvent({
        type: "llm_call_started",
        projectId: ctx.projectId,
        timestamp: new Date().toISOString(),
        data: { logId: log.id, role: ctx.role, phase: ctx.phase },
      }).catch(() => {})

      try {
        const response = await provider.chat(messages, options)

        // Include function call details in logged response
        let loggedResponse = response.content
        if (response.functionCall) {
          const fcSummary = `\n\n---\n[Function Call] ${response.functionCall.name}(${response.functionCall.arguments})`
          loggedResponse = (response.content || "") + fcSummary
        }

        await llmLogRepo.complete(log.id, loggedResponse.slice(0, 100_000), response.durationMs)

        await publishEvent({
          type: "llm_call_completed",
          projectId: ctx.projectId,
          timestamp: new Date().toISOString(),
          data: { logId: log.id, durationMs: response.durationMs, model: response.model },
        }).catch(() => {})

        return response
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await llmLogRepo.fail(log.id, message).catch(() => {})

        await publishEvent({
          type: "llm_call_failed",
          projectId: ctx.projectId,
          timestamp: new Date().toISOString(),
          data: { logId: log.id, error: message.slice(0, 500) },
        }).catch(() => {})

        throw err
      }
    },
  }
}
