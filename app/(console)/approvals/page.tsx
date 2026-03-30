import { ApprovalCenterClient } from "@/components/approvals/approval-center-client"
import { listStoredApprovals } from "@/lib/approval-repository"

export default async function ApprovalsPage() {
  const items = await listStoredApprovals()
  const data = { items, total: items.length }
  const { items: approvals } = data

  return <ApprovalCenterClient initialApprovals={approvals} />
}
