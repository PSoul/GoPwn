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

export async function decide(id: string, status: ApprovalStatus, note?: string) {
  return prisma.approval.update({
    where: { id },
    data: {
      status,
      decidedAt: new Date(),
      decisionNote: note ?? "",
    },
  })
}
