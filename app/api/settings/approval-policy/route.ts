import { approvalControlPatchSchema } from "@/lib/approval-write-schema"
import { getApprovalPolicyPayload, updateGlobalApprovalControlPayload } from "@/lib/prototype-api"

export async function GET() {
  return Response.json(getApprovalPolicyPayload())
}

export async function PATCH(request: Request) {
  const body = await request.json()
  const parsed = approvalControlPatchSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid approval policy payload" }, { status: 400 })
  }

  return Response.json({
    approvalControl: updateGlobalApprovalControlPayload(parsed.data),
  })
}
