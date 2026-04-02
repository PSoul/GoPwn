import { getAgentConfig } from "@/lib/agent-config"
import { dispatchStoredMcpRun, getStoredMcpRunById } from "@/lib/mcp-gateway-repository"
import { drainStoredSchedulerTasks } from "@/lib/mcp-scheduler-service"
import type { McpDispatchInput, McpDispatchPayload } from "@/lib/prototype-types"

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<{ result: T; timedOut: false } | { timedOut: true; pendingPromise: Promise<T> }> {
  return Promise.race([
    promise.then((result) => ({ result, timedOut: false as const })),
    new Promise<{ timedOut: true; pendingPromise: Promise<T> }>((resolve) =>
      setTimeout(() => resolve({ timedOut: true, pendingPromise: promise }), ms),
    ),
  ])
}

export async function dispatchProjectMcpRunAndDrain(
  projectId: string,
  input: McpDispatchInput,
  options?: {
    ignoreProjectLifecycle?: boolean
  },
): Promise<McpDispatchPayload | null> {
  const payload = await dispatchStoredMcpRun(projectId, input)

  if (!payload || payload.approval || payload.run.status === "已阻塞") {
    return payload
  }

  const config = getAgentConfig()
  const drainTimeoutMs = config.execution.toolTimeoutDefaultSeconds * 1000

  const outcome = await withTimeout(
    drainStoredSchedulerTasks({
      ignoreProjectLifecycle: options?.ignoreProjectLifecycle,
      runId: payload.run.id,
    }),
    drainTimeoutMs,
  )

  if (outcome.timedOut) {
    // Drain timed out — the tool is still executing in the background.
    // Register a background completion handler so the result isn't lost.
    const runId = payload.run.id
    outcome.pendingPromise
      .then(async (drainResult) => {
        const completedRun = drainResult.runs.at(-1)
        console.info(
          `[dispatch] background drain completed for run ${runId}: status=${completedRun?.status ?? "unknown"}`,
        )
      })
      .catch((err) => {
        console.warn(`[dispatch] background drain failed for run ${runId}:`, err)
      })

    const currentRun = await getStoredMcpRunById(runId)
    console.warn(
      `[dispatch] drain timeout after ${config.execution.toolTimeoutDefaultSeconds}s for run ${runId} (${input.preferredToolName ?? input.capability}). Returning current state.`,
    )
    return {
      ...payload,
      run: currentRun ?? payload.run,
    }
  }

  const executedRun = outcome.result.runs.at(-1)

  return {
    ...payload,
    run: executedRun ?? payload.run,
  }
}
