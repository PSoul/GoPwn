import { prisma } from "@/lib/infra/prisma"

export async function findByProject(projectId: string) {
  return prisma.llmCallLog.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  })
}

export async function create(data: {
  projectId: string
  role: string
  phase: string
  prompt: string
  model: string
  provider: string
}) {
  return prisma.llmCallLog.create({
    data: { ...data, status: "streaming" },
  })
}

export async function complete(id: string, response: string, durationMs: number) {
  return prisma.llmCallLog.update({
    where: { id },
    data: { response, durationMs, status: "completed" },
  })
}

export async function fail(id: string, error: string) {
  return prisma.llmCallLog.update({
    where: { id },
    data: { error, status: "failed" },
  })
}

export async function cleanupStale(maxAgeMinutes = 10) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000)
  return prisma.llmCallLog.updateMany({
    where: { status: "streaming", createdAt: { lt: cutoff } },
    data: { status: "failed", error: "Stale: cleaned up on worker startup" },
  })
}
