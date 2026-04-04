import { apiHandler, json } from "@/lib/infra/api-handler"
import * as assetService from "@/lib/services/asset-service"

export const GET = apiHandler(async (req, ctx) => {
  const { projectId } = await ctx.params
  const url = new URL(req.url)
  const view = url.searchParams.get("view")

  if (view === "tree") {
    const tree = await assetService.getAssetTree(projectId)
    return json(tree)
  }

  const assets = await assetService.listByProject(projectId)
  return json(assets)
})
