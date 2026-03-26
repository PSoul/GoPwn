import { archiveProjectOverviewPayload } from "@/lib/prototype-api"

type ProjectArchiveRouteContext = {
  params: Promise<{ projectId: string }>
}

export async function POST(_request: Request, { params }: ProjectArchiveRouteContext) {
  const { projectId } = await params
  const payload = archiveProjectOverviewPayload(projectId)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  return Response.json(payload)
}
