import { listStoredEvidence } from "@/lib/data/evidence-repository"
import { withApiHandler } from "@/lib/infra/api-handler"

export const GET = withApiHandler(async () => {
  const items = await listStoredEvidence()
  return Response.json({ items, total: items.length })
})
