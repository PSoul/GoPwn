import { approvalControlPatchSchema } from "@/lib/approval-write-schema"
import { getApprovalPolicyPayload, updateGlobalApprovalControlPayload } from "@/lib/prototype-api"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async () => {
  return Response.json(getApprovalPolicyPayload())
})

export const PATCH = withApiHandler(async (request) => {
  const body = await request.json()
  const parsed = approvalControlPatchSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid approval policy payload" }, { status: 400 })
  }

  return Response.json({
    approvalControl: updateGlobalApprovalControlPayload(parsed.data),
  })
})
