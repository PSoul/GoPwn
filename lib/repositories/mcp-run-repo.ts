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

const TERMINAL_STATUSES: McpRunStatus[] = ["succeeded", "failed", "cancelled"]

export async function updateStatus(id: string, status: McpRunStatus, extra?: {
  pgBossJobId?: string
  rawOutput?: string
  error?: string
  startedAt?: Date
  completedAt?: Date
}) {
  const updated = await prisma.mcpRun.update({
    where: { id },
    data: { status, ...extra },
  })

  // When a run reaches terminal state, check if all runs in the round are done
  // This catches cases where runs are cleaned up externally (stale recovery, manual cancel)
  if (TERMINAL_STATUSES.includes(status) && updated.round > 0) {
    void checkAndPublishRoundCompletion(updated.projectId, updated.round)
  }

  return updated
}

/**
 * Check if all runs in a round are terminal and publish round_completed if so.
 * Fire-and-forget — errors are swallowed to avoid breaking the caller.
 */
async function checkAndPublishRoundCompletion(projectId: string, round: number) {
  try {
    const runs = await prisma.mcpRun.findMany({
      where: { projectId, round },
      select: { status: true },
    })
    const allDone = runs.length > 0 && runs.every((r) => TERMINAL_STATUSES.includes(r.status as McpRunStatus))
    if (allDone) {
      const { createPgBossJobQueue } = await import("@/lib/infra/job-queue")
      const queue = createPgBossJobQueue()
      const startAfter = new Date(Date.now() + 30_000)
      await queue.publish("round_completed", { projectId, round }, {
        singletonKey: `round-complete-${projectId}-${round}`,
        startAfter: startAfter.toISOString(),
      })
    }
  } catch {
    // Best-effort — don't break the status update caller
  }
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

/**
 * Fail runs that have been stuck in "running" beyond the given age.
 * Returns the number of runs that were force-failed.
 */
export async function failStaleRunningRuns(projectId: string, maxAgeMs: number = 10 * 60 * 1000) {
  const cutoff = new Date(Date.now() - maxAgeMs)
  const stale = await prisma.mcpRun.findMany({
    where: {
      projectId,
      status: "running",
      updatedAt: { lt: cutoff },
    },
    select: { id: true, round: true },
  })
  if (stale.length === 0) return 0

  await prisma.mcpRun.updateMany({
    where: { id: { in: stale.map((r) => r.id) } },
    data: { status: "failed", error: "Force-failed: exceeded max running time", completedAt: new Date() },
  })

  // Trigger round completion check for affected rounds
  const rounds = [...new Set(stale.map((r) => r.round))]
  for (const round of rounds) {
    void checkAndPublishRoundCompletion(projectId, round)
  }

  return stale.length
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
