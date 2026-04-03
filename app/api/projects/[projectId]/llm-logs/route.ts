import { listLlmCallLogs } from "@/lib/llm/llm-call-logger"
import { withApiHandler } from "@/lib/infra/api-handler"
import type { LlmCallRole } from "@/lib/prototype-types"

export const GET = withApiHandler(async (request, context) => {
  const { projectId } = (await context.params) as { projectId: string }
  const url = new URL(request.url)
  const role = url.searchParams.get("role") as LlmCallRole | null
  const status = url.searchParams.get("status")
  const since = url.searchParams.get("since")

  const logs = await listLlmCallLogs(projectId, {
    role: role ?? undefined,
    status: status ?? undefined,
    since: since ?? undefined,
  })

  return Response.json({ items: logs, total: logs.length })
})
