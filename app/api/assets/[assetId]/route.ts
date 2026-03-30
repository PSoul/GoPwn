import { getStoredAssetById } from "@/lib/asset-repository"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async (_request, { params }) => {
  const { assetId } = await params
  const asset = await getStoredAssetById(assetId)

  if (!asset) {
    return Response.json({ error: `Asset '${assetId}' not found` }, { status: 404 })
  }

  return Response.json({ asset })
})
