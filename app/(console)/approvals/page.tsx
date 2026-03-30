import { ApprovalCenterClient } from "@/components/approvals/approval-center-client"
import { listApprovalsPayload } from "@/lib/prototype-api"

export default async function ApprovalsPage() {
  const { items: approvals } = await listApprovalsPayload()

  return <ApprovalCenterClient initialApprovals={approvals} />
}
