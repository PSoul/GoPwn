import { getProjectOperationsPayload } from "@/lib/infra/api-compositions"
import { withApiHandler } from "@/lib/infra/api-handler"

export const GET = withApiHandler(async (_request, { params }) => {
  const { projectId } = await params
  const payload = await getProjectOperationsPayload(projectId)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  return Response.json(payload)
})
