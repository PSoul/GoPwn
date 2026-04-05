import * as approvalRepo from "@/lib/repositories/approval-repo"
import * as mcpRunRepo from "@/lib/repositories/mcp-run-repo"
import * as auditRepo from "@/lib/repositories/audit-repo"
import { NotFoundError, DomainError } from "@/lib/domain/errors"
import { publishEvent } from "@/lib/infra/event-bus"
import type { ApprovalStatus } from "@/lib/generated/prisma"

export async function listByProject(projectId: string) {
  return approvalRepo.findByProject(projectId)
}

export async function decide(approvalId: string, decision: ApprovalStatus, note?: string) {
  const approval = await approvalRepo.findById(approvalId)
  if (!approval) throw new NotFoundError("Approval", approvalId)
  if (approval.status !== "pending") {
    throw new DomainError(`Approval already resolved: ${approval.status}`, "ALREADY_RESOLVED", 409)
  }

  await approvalRepo.decide(approvalId, decision, note)

  if (decision === "approved" && approval.mcpRunId) {
    // TODO(react): ReAct 模式下审批逻辑待重新设计。
    // ReAct 循环内工具执行是内联的，不再通过独立 execute_tool job 派发。
    // 未来审批将暂停 ReAct 循环，审批通过后恢复。
    // 当前初版为全自动模式，此分支仅更新状态。
    await mcpRunRepo.updateStatus(approval.mcpRunId, "scheduled")
  } else if (decision === "rejected" && approval.mcpRunId) {
    await mcpRunRepo.updateStatus(approval.mcpRunId, "cancelled")
  }

  // Check if all pending approvals are resolved — if so, transition back to executing
  const remaining = await approvalRepo.findPending(approval.projectId)
  if (remaining.length === 0) {
    const { transition } = await import("@/lib/domain/lifecycle")
    const projectRepo = await import("@/lib/repositories/project-repo")
    const project = await projectRepo.findById(approval.projectId)
    if (project && project.lifecycle === "waiting_approval") {
      await projectRepo.updateLifecycle(approval.projectId, transition("waiting_approval", "RESOLVED"))
    }
  }

  await publishEvent({
    type: "approval_decided",
    projectId: approval.projectId,
    timestamp: new Date().toISOString(),
    data: { approvalId, decision, mcpRunId: approval.mcpRunId },
  })

  await auditRepo.create({
    projectId: approval.projectId,
    category: "approval",
    action: decision,
    actor: "user",
    detail: note ?? "",
  })

  return { status: decision }
}
