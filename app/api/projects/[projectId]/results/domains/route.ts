import { getProjectInventoryPayload } from "@/lib/prototype-api"

type ProjectRouteContext = {
  params: Promise<{ projectId: string }>
}

export async function GET(_request: Request, { params }: ProjectRouteContext) {
  const { projectId } = await params
  const payload = getProjectInventoryPayload(projectId, "域名 / Web 入口")

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' or domains result not found` }, { status: 404 })
  }

  return Response.json(payload)
}
