import { listStoredAuditLogs } from "@/lib/project/project-repository"
import { withApiHandler } from "@/lib/infra/api-handler"

export const GET = withApiHandler(async () => {
  const items = await listStoredAuditLogs()
  return Response.json({ items, total: items.length })
})
