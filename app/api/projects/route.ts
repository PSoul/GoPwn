import { apiHandler, json } from "@/lib/infra/api-handler"
import * as projectService from "@/lib/services/project-service"

export const GET = apiHandler(async () => {
  const projects = await projectService.listProjects()
  return json(projects)
})

export const POST = apiHandler(async (req) => {
  const body = (await req.json()) as { name: string; targetInput: string; description?: string }
  const project = await projectService.createProject(body)
  return json(project, 201)
})
