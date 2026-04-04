import { prisma } from "@/lib/infra/prisma"
import type { McpRunStatus, RiskLevel, PentestPhase } from "@/lib/generated/prisma"

export async function findByProject(projectId: string) {
  return prisma.mcpRun.findMany({
    where: { projectId },
    include: { approval: true, tool: true },
    orderBy: { createdAt: "desc" },
  })
}

export async function findByProjectAndRound(projectId: string, round: number) {
  return prisma.mcpRun.findMany({
    where: { projectId, round },
    include: { approval: true },
  })
}

export async function findById(id: string) {
  return prisma.mcpRun.findUnique({
    where: { id },
    include: { approval: true, tool: true, evidence: true, pocs: true },
  })
}

export async function create(data: {
  projectId: string
  toolId?: string
  capability: string
  toolName: string
  target: string
  requestedAction: string
  riskLevel: RiskLevel
  phase: PentestPhase
  round: number
}) {
  return prisma.mcpRun.create({ data })
}

export async function updateStatus(id: string, status: McpRunStatus, extra?: {
  pgBossJobId?: string
  rawOutput?: string
  error?: string
  startedAt?: Date
  completedAt?: Date
}) {
  return prisma.mcpRun.update({
    where: { id },
    data: { status, ...extra },
  })
}

export async function countByProjectAndStatus(projectId: string) {
  return prisma.mcpRun.groupBy({
    by: ["status"],
    where: { projectId },
    _count: true,
  })
}

export async function countPendingByProject(projectId: string) {
  return prisma.mcpRun.count({
    where: {
      projectId,
      status: { in: ["pending", "scheduled", "running"] },
    },
  })
}

export async function cancelPendingByProject(projectId: string) {
  return prisma.mcpRun.updateMany({
    where: {
      projectId,
      status: { in: ["pending", "scheduled", "running"] },
    },
    data: { status: "cancelled" },
  })
}
