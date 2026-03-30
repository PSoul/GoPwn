import { listStoredEvidence } from "@/lib/evidence-repository"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async () => {
  const items = await listStoredEvidence()
  return Response.json({ items, total: items.length })
})
