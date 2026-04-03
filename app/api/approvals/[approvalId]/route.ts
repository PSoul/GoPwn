import { approvalDecisionSchema } from "@/lib/data/approval-write-schema"
import { getStoredApprovalById } from "@/lib/data/approval-repository"
import { updateApprovalDecisionPayload } from "@/lib/infra/api-compositions"
import { withApiHandler } from "@/lib/infra/api-handler"

export const GET = withApiHandler(async (_request, { params }) => {
  const { approvalId } = await params
  const payload = await getStoredApprovalById(approvalId)

  if (!payload) {
    return Response.json({ error: `Approval '${approvalId}' not found` }, { status: 404 })
  }

  return Response.json({ approval: payload })
})

export const PATCH = withApiHandler(async (request, { params }) => {
  const { approvalId } = await params
  const body = await request.json()
  const parsed = approvalDecisionSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid approval decision payload" }, { status: 400 })
  }

  const payload = await updateApprovalDecisionPayload(approvalId, parsed.data)

  if (!payload) {
    return Response.json({ error: `Approval '${approvalId}' not found` }, { status: 404 })
  }

  return Response.json({ approval: payload })
})
