import { archiveStoredProject } from "@/lib/project/project-repository"
import { withApiHandler } from "@/lib/infra/api-handler"

export const POST = withApiHandler(async (_request, { params }) => {
  const { projectId } = await params
  const payload = await archiveStoredProject(projectId)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  return Response.json(payload)
})
