import { getStoredProjectById, getStoredProjectDetailById, updateStoredProject } from "@/lib/project/project-repository"
import { projectPatchSchema } from "@/lib/project/project-write-schema"
import { withApiHandler } from "@/lib/infra/api-handler"

export const GET = withApiHandler(async (_request, { params }) => {
  const { projectId } = await params
  const project = await getStoredProjectById(projectId)
  const detail = await getStoredProjectDetailById(projectId)

  if (!project || !detail) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  return Response.json({ project, detail })
})

export const PATCH = withApiHandler(async (request, { params }) => {
  const { projectId } = await params
  const body = await request.json()
  const parsed = projectPatchSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid project patch payload" }, { status: 400 })
  }

  const payload = await updateStoredProject(projectId, parsed.data)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  return Response.json(payload)
})
