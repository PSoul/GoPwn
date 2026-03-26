import { getProjectOverviewPayload, updateProjectOverviewPayload } from "@/lib/prototype-api"
import { projectPatchSchema } from "@/lib/project-write-schema"

type ProjectRouteContext = {
  params: Promise<{ projectId: string }>
}

export async function GET(_request: Request, { params }: ProjectRouteContext) {
  const { projectId } = await params
  const payload = getProjectOverviewPayload(projectId)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  return Response.json(payload)
}

export async function PATCH(request: Request, { params }: ProjectRouteContext) {
  const { projectId } = await params
  const body = await request.json()
  const parsed = projectPatchSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid project patch payload" }, { status: 400 })
  }

  const payload = updateProjectOverviewPayload(projectId, parsed.data)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  return Response.json(payload)
}
