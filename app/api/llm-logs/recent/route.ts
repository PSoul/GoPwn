import { listAllRecentLlmCallLogs } from "@/lib/llm-call-logger"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async (request) => {
  const url = new URL(request.url)
  const limit = Number(url.searchParams.get("limit") ?? "50")

  const logs = listAllRecentLlmCallLogs(limit)

  return Response.json({ items: logs, total: logs.length })
})
