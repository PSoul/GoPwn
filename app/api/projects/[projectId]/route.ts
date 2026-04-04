import { apiHandler, json } from "@/lib/infra/api-handler"
import * as projectService from "@/lib/services/project-service"

export const GET = apiHandler(async (_req, ctx) => {
  const { projectId } = await ctx.params
  const project = await projectService.getProject(projectId)
  return json(project)
})

export const DELETE = apiHandler(async (_req, ctx) => {
  const { projectId } = await ctx.params
  await projectService.deleteProject(projectId)
  return json({ ok: true })
})
