import { apiHandler, json } from "@/lib/infra/api-handler"
import * as projectService from "@/lib/services/project-service"

export const POST = apiHandler(async (_req, ctx) => {
  const { projectId } = await ctx.params
  const result = await projectService.stopProject(projectId)
  return json(result, 202)
})
