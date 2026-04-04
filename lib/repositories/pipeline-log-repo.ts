import { prisma } from "@/lib/infra/prisma"
import type { PipelineLog } from "@/lib/generated/prisma"

export async function create(data: {
  projectId: string
  round?: number
  jobType: string
  jobId?: string
  stage: string
  level: string
  message: string
  data?: unknown
  duration?: number
}): Promise<PipelineLog> {
  return prisma.pipelineLog.create({
    data: {
      projectId: data.projectId,
      round: data.round,
      jobType: data.jobType,
      jobId: data.jobId,
      stage: data.stage,
      level: data.level,
      message: data.message,
      data: data.data ?? undefined,
      duration: data.duration,
    },
  })
}

const LEVEL_ORDER = ["debug", "info", "warn", "error"]

export async function findByProject(
  projectId: string,
  options?: { round?: number; level?: string; limit?: number; offset?: number },
): Promise<PipelineLog[]> {
  const minLevel = options?.level ?? "info"
  const minIndex = LEVEL_ORDER.indexOf(minLevel)
  const levels = LEVEL_ORDER.slice(minIndex)

  return prisma.pipelineLog.findMany({
    where: {
      projectId,
      ...(options?.round != null ? { round: options.round } : {}),
      level: { in: levels },
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 100,
    skip: options?.offset ?? 0,
  })
}

export async function countByProject(projectId: string, level?: string): Promise<number> {
  const minLevel = level ?? "info"
  const minIndex = LEVEL_ORDER.indexOf(minLevel)
  const levels = LEVEL_ORDER.slice(minIndex)

  return prisma.pipelineLog.count({
    where: { projectId, level: { in: levels } },
  })
}

export async function cleanupOld(daysToKeep: number = 30): Promise<number> {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)
  const result = await prisma.pipelineLog.deleteMany({
    where: { level: "debug", createdAt: { lt: cutoff } },
  })
  return result.count
}
