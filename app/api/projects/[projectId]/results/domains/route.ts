import { getProjectInventoryPayload } from "@/lib/prototype-api"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async (_request, { params }) => {
  const { projectId } = await params
  const payload = await getProjectInventoryPayload(projectId, "域名 / Web 入口")

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' or domains result not found` }, { status: 404 })
  }

  return Response.json(payload)
})
