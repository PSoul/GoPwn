import { getEvidenceDetailPayload } from "@/lib/prototype-api"

type EvidenceRouteContext = {
  params: Promise<{ evidenceId: string }>
}

export async function GET(_request: Request, { params }: EvidenceRouteContext) {
  const { evidenceId } = await params
  const payload = getEvidenceDetailPayload(evidenceId)

  if (!payload) {
    return Response.json({ error: `Evidence '${evidenceId}' not found` }, { status: 404 })
  }

  return Response.json(payload)
}
