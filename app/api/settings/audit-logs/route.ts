import { listStoredAuditLogs } from "@/lib/project-repository"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async () => {
  const items = await listStoredAuditLogs()
  return Response.json({ items, total: items.length })
})
