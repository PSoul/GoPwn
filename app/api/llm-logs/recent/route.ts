import { listAllRecentLlmCallLogs } from "@/lib/llm-call-logger"
import { readPrototypeStore } from "@/lib/prototype-store"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async (request) => {
  const url = new URL(request.url)
  const limit = Number(url.searchParams.get("limit") ?? "50")

  const logs = listAllRecentLlmCallLogs(limit)

  // Enrich with project names for logs that lack it (legacy records)
  const store = readPrototypeStore()
  const projectNameMap = new Map(store.projects.map((p) => [p.id, p.name]))
  const enriched = logs.map((l) => ({
    ...l,
    projectName: l.projectName ?? projectNameMap.get(l.projectId) ?? "未知项目",
  }))

  return Response.json({ items: enriched, total: enriched.length })
})
