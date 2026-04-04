import { apiHandler, json } from "@/lib/infra/api-handler"
import * as mcpRunRepo from "@/lib/repositories/mcp-run-repo"

export const GET = apiHandler(async (_req, ctx) => {
  const { projectId } = await ctx.params
  const runs = await mcpRunRepo.findByProject(projectId)
  return json(runs)
})
