import { describe, it, expect } from "vitest"
import { requiresApproval, type ApprovalPolicy } from "@/lib/domain/risk-policy"

describe("risk-policy requiresApproval", () => {
  const enabledPolicy: ApprovalPolicy = {
    approvalEnabled: true,
    autoApproveLowRisk: true,
    autoApproveMediumRisk: false,
  }

  const disabledPolicy: ApprovalPolicy = {
    approvalEnabled: false,
    autoApproveLowRisk: false,
    autoApproveMediumRisk: false,
  }

  const fullAutoPolicy: ApprovalPolicy = {
    approvalEnabled: true,
    autoApproveLowRisk: true,
    autoApproveMediumRisk: true,
  }

  it("approvalEnabled=false → 一律不需要审批", () => {
    expect(requiresApproval("high", disabledPolicy)).toBe(false)
    expect(requiresApproval("medium", disabledPolicy)).toBe(false)
    expect(requiresApproval("low", disabledPolicy)).toBe(false)
  })

  it("low risk + autoApproveLow=true → 不需要审批", () => {
    expect(requiresApproval("low", enabledPolicy)).toBe(false)
  })

  it("medium risk + autoApproveMedium=false → 需要审批", () => {
    expect(requiresApproval("medium", enabledPolicy)).toBe(true)
  })

  it("high risk → 始终需要审批（当 approvalEnabled=true）", () => {
    expect(requiresApproval("high", enabledPolicy)).toBe(true)
    expect(requiresApproval("high", fullAutoPolicy)).toBe(true)
  })

  it("medium risk + autoApproveMedium=true → 不需要审批", () => {
    expect(requiresApproval("medium", fullAutoPolicy)).toBe(false)
  })
})
