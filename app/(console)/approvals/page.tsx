import { ApprovalCenterClient } from "@/components/approvals/approval-center-client"
import { listApprovalsPayload } from "@/lib/prototype-api"

export default function ApprovalsPage() {
  const { items: approvals } = listApprovalsPayload()

  return <ApprovalCenterClient initialApprovals={approvals} />
}
