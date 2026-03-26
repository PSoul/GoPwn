import { approvalControlPatchSchema } from "@/lib/approval-write-schema"
import { updateProjectApprovalControlPayload } from "@/lib/prototype-api"

type ProjectApprovalControlRouteContext = {
  params: Promise<{ projectId: string }>
}

export async function PATCH(request: Request, { params }: ProjectApprovalControlRouteContext) {
  const { projectId } = await params
  const body = await request.json()
  const parsed = approvalControlPatchSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid project approval-control payload" }, { status: 400 })
  }

  const payload = updateProjectApprovalControlPayload(projectId, parsed.data)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  return Response.json(payload)
}
