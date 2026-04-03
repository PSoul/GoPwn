import { listStoredWorkLogs } from "@/lib/data/work-log-repository"
import { withApiHandler } from "@/lib/infra/api-handler"

export const GET = withApiHandler(async () => {
  const items = await listStoredWorkLogs()
  return Response.json({ items, total: items.length })
})
