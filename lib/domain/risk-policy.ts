import type { RiskLevel } from "@/lib/generated/prisma"

export type ApprovalPolicy = {
  approvalEnabled: boolean
  autoApproveLowRisk: boolean
  autoApproveMediumRisk: boolean
}

export function requiresApproval(riskLevel: RiskLevel, policy: ApprovalPolicy): boolean {
  if (!policy.approvalEnabled) return false
  if (riskLevel === "low" && policy.autoApproveLowRisk) return false
  if (riskLevel === "medium" && policy.autoApproveMediumRisk) return false
  return true
}
