import { listStoredApprovals } from "@/lib/data/approval-repository"
import { withApiHandler } from "@/lib/infra/api-handler"

export const GET = withApiHandler(async () => {
  const items = await listStoredApprovals()
  return Response.json({ items, total: items.length })
})
