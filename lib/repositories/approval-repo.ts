import { prisma } from "@/lib/infra/prisma"
import type { ApprovalStatus, RiskLevel } from "@/lib/generated/prisma"

export async function findByProject(projectId: string) {
  return prisma.approval.findMany({
    where: { projectId },
    include: { mcpRun: true },
    orderBy: { createdAt: "desc" },
  })
}

export async function findPending(projectId: string) {
  return prisma.approval.findMany({
    where: { projectId, status: "pending" },
    include: { mcpRun: true },
    orderBy: { createdAt: "asc" },
  })
}

export async function findById(id: string) {
  return prisma.approval.findUnique({
    where: { id },
    include: { mcpRun: true },
  })
}

export async function create(data: {
  projectId: string
  mcpRunId: string
  target: string
  actionType: string
  riskLevel: RiskLevel
  rationale?: string
}) {
  return prisma.approval.create({
    data: {
      projectId: data.projectId,
      mcpRunId: data.mcpRunId,
      target: data.target,
      actionType: data.actionType,
      riskLevel: data.riskLevel,
      rationale: data.rationale ?? "",
    },
  })
}

/**
 * Atomically decide an approval — only updates if still pending.
 * Returns the number of rows updated (0 = already decided, 1 = success).
 */
export async function decide(id: string, status: ApprovalStatus, note?: string) {
  const result = await prisma.approval.updateMany({
    where: { id, status: "pending" },
    data: {
      status,
      decidedAt: new Date(),
      decisionNote: note ?? "",
    },
  })
  return result.count
}

export async function cancelPendingByProject(projectId: string) {
  return prisma.approval.updateMany({
    where: { projectId, status: "pending" },
    data: { status: "rejected", decidedAt: new Date(), decisionNote: "Auto-cancelled: project stopped" },
  })
}
