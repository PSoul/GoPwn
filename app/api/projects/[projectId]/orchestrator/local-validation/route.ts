import { localValidationRunSchema } from "@/lib/mcp-write-schema"
import { executeProjectLocalValidationPayload } from "@/lib/prototype-api"

type ProjectRouteContext = {
  params: Promise<{ projectId: string }>
}

export async function POST(request: Request, { params }: ProjectRouteContext) {
  const { projectId } = await params
  const body = await request.json()
  const parsed = localValidationRunSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid local validation payload" }, { status: 400 })
  }

  const payload = await executeProjectLocalValidationPayload(projectId, parsed.data)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' or local lab not found` }, { status: 404 })
  }

  return Response.json(payload, { status: payload.status === "completed" ? 200 : 202 })
}
