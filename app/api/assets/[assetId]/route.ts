import { getAssetDetailPayload } from "@/lib/prototype-api"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async (_request, { params }) => {
  const { assetId } = await params
  const payload = await getAssetDetailPayload(assetId)

  if (!payload) {
    return Response.json({ error: `Asset '${assetId}' not found` }, { status: 404 })
  }

  return Response.json(payload)
})
