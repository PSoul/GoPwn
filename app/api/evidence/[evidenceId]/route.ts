import { getEvidenceDetailPayload } from "@/lib/prototype-api"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async (_request, { params }) => {
  const { evidenceId } = await params
  const payload = await getEvidenceDetailPayload(evidenceId)

  if (!payload) {
    return Response.json({ error: `Evidence '${evidenceId}' not found` }, { status: 404 })
  }

  return Response.json(payload)
})
