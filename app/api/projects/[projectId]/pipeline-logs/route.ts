import { apiHandler, json } from "@/lib/infra/api-handler"
import * as pipelineLogRepo from "@/lib/repositories/pipeline-log-repo"

export const GET = apiHandler(async (req, ctx) => {
  const { projectId } = await ctx.params
  const url = new URL(req.url)

  const round = url.searchParams.get("round")
  const level = url.searchParams.get("level") ?? "info"
  const limit = parseInt(url.searchParams.get("limit") ?? "100", 10)
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10)

  const [logs, total] = await Promise.all([
    pipelineLogRepo.findByProject(projectId, {
      round: round != null ? parseInt(round, 10) : undefined,
      level,
      limit: Math.min(limit, 200),
      offset,
    }),
    pipelineLogRepo.countByProject(projectId, level),
  ])

  return json({ logs, total })
})
