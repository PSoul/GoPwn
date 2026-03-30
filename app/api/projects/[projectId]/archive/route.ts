import { archiveProjectOverviewPayload } from "@/lib/prototype-api"
import { withApiHandler } from "@/lib/api-handler"

export const POST = withApiHandler(async (_request, { params }) => {
  const { projectId } = await params
  const payload = await archiveProjectOverviewPayload(projectId)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  return Response.json(payload)
})
