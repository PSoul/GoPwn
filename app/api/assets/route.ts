import { listStoredAssets } from "@/lib/data/asset-repository"
import { buildAssetViews } from "@/lib/infra/api-compositions"
import { withApiHandler } from "@/lib/infra/api-handler"

export const GET = withApiHandler(async () => {
  const items = await listStoredAssets()
  return Response.json({ items, total: items.length, views: buildAssetViews(items) })
})
