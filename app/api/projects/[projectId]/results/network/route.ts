import { getProjectInventoryPayload } from "@/lib/prototype-api"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async (_request, { params }) => {
  const { projectId } = await params
  const payload = getProjectInventoryPayload(projectId, "IP / 端口 / 服务")

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' or network result not found` }, { status: 404 })
  }

  return Response.json(payload)
})
