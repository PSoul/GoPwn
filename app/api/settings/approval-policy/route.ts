import { approvalControlPatchSchema } from "@/lib/data/approval-write-schema"
import { getApprovalPolicyPayload } from "@/lib/infra/api-compositions"
import { updateStoredGlobalApprovalControl } from "@/lib/data/approval-repository"
import { withApiHandler } from "@/lib/infra/api-handler"

export const GET = withApiHandler(async () => {
  return Response.json(await getApprovalPolicyPayload())
})

export const PATCH = withApiHandler(async (request) => {
  const body = await request.json()
  const parsed = approvalControlPatchSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid approval policy payload" }, { status: 400 })
  }

  return Response.json({
    approvalControl: await updateStoredGlobalApprovalControl(parsed.data),
  })
})
