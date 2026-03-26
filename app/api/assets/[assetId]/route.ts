import { getAssetDetailPayload } from "@/lib/prototype-api"

type AssetRouteContext = {
  params: Promise<{ assetId: string }>
}

export async function GET(_request: Request, { params }: AssetRouteContext) {
  const { assetId } = await params
  const payload = getAssetDetailPayload(assetId)

  if (!payload) {
    return Response.json({ error: `Asset '${assetId}' not found` }, { status: 404 })
  }

  return Response.json(payload)
}
