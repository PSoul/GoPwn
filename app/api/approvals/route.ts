import { listStoredApprovals } from "@/lib/approval-repository"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async () => {
  const items = await listStoredApprovals()
  return Response.json({ items, total: items.length })
})
