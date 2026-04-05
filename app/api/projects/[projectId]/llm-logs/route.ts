import { apiHandler, json } from "@/lib/infra/api-handler"
import * as llmLogRepo from "@/lib/repositories/llm-log-repo"

export const GET = apiHandler(async (_req, ctx) => {
  const { projectId } = await ctx.params
  const logs = await llmLogRepo.findByProject(projectId)
  return json({ items: logs })
})
