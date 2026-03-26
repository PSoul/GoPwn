import { dispatchStoredMcpRun } from "@/lib/mcp-gateway-repository"
import { drainStoredSchedulerTasks } from "@/lib/mcp-scheduler-service"
import type { McpDispatchInput, McpDispatchPayload } from "@/lib/prototype-types"

export async function dispatchProjectMcpRunAndDrain(
  projectId: string,
  input: McpDispatchInput,
): Promise<McpDispatchPayload | null> {
  const payload = dispatchStoredMcpRun(projectId, input)

  if (!payload || payload.approval || payload.run.status === "已阻塞") {
    return payload
  }

  const drained = await drainStoredSchedulerTasks({ runId: payload.run.id })
  const executedRun = drained.runs.at(-1)

  return {
    ...payload,
    run: executedRun ?? payload.run,
  }
}
