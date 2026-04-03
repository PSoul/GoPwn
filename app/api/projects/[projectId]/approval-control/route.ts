import { approvalControlPatchSchema } from "@/lib/data/approval-write-schema"
import { updateStoredProjectApprovalControl } from "@/lib/data/approval-repository"
import { withApiHandler } from "@/lib/infra/api-handler"

export const PATCH = withApiHandler(async (request, { params }) => {
  const { projectId } = await params
  const body = await request.json()
  const parsed = approvalControlPatchSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid project approval-control payload" }, { status: 400 })
  }

  const payload = await updateStoredProjectApprovalControl(projectId, parsed.data)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  return Response.json(payload)
})
