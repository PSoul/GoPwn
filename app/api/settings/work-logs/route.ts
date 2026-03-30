import { listStoredWorkLogs } from "@/lib/work-log-repository"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async () => {
  const items = await listStoredWorkLogs()
  return Response.json({ items, total: items.length })
})
