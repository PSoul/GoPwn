import { listStoredAssets } from "@/lib/asset-repository"
import { buildAssetViews } from "@/lib/api-compositions"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async () => {
  const items = await listStoredAssets()
  return Response.json({ items, total: items.length, views: buildAssetViews(items) })
})
