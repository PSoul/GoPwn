import { listAllRecentLlmCallLogs } from "@/lib/llm/llm-call-logger"
import { listStoredProjects } from "@/lib/project/project-repository"
import { withApiHandler } from "@/lib/infra/api-handler"

export const GET = withApiHandler(async (request) => {
  const url = new URL(request.url)
  const limit = Number(url.searchParams.get("limit") ?? "50")

  const logs = await listAllRecentLlmCallLogs(limit)

  // Enrich with project names for logs that lack it (legacy records)
  const projects = await listStoredProjects()
  const projectNameMap = new Map(projects.map((p) => [p.id, p.name]))
  const enriched = logs.map((l) => ({
    ...l,
    projectName: l.projectName ?? projectNameMap.get(l.projectId) ?? "未知项目",
  }))

  return Response.json({ items: enriched, total: enriched.length })
})
