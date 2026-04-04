import { prisma } from "@/lib/infra/prisma"
import type { ProjectLifecycle, PentestPhase } from "@/lib/generated/prisma"

export async function findAll() {
  return prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      targets: true,
      _count: { select: { assets: true, findings: true, mcpRuns: true, approvals: true } },
    },
  })
}

export async function findById(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      targets: true,
      rounds: { orderBy: { round: "desc" }, take: 5 },
    },
  })
}

export async function findByCode(code: string) {
  return prisma.project.findUnique({ where: { code } })
}

export async function create(data: {
  code: string
  name: string
  description?: string
  targets: Array<{ value: string; type: string; normalized: string }>
}) {
  return prisma.project.create({
    data: {
      code: data.code,
      name: data.name,
      description: data.description ?? "",
      targets: { create: data.targets },
    },
    include: { targets: true },
  })
}

export async function updateLifecycle(id: string, lifecycle: ProjectLifecycle) {
  return prisma.project.update({
    where: { id },
    data: { lifecycle },
  })
}

export async function updatePhaseAndRound(id: string, phase: PentestPhase, round: number) {
  return prisma.project.update({
    where: { id },
    data: { currentPhase: phase, currentRound: round },
  })
}

export async function deleteById(id: string) {
  return prisma.project.delete({ where: { id } })
}

export async function findByLifecycles(states: readonly string[]) {
  return prisma.project.findMany({
    where: { lifecycle: { in: states as ProjectLifecycle[] } },
    include: { targets: true },
  })
}

export async function countByLifecycle() {
  return prisma.project.groupBy({
    by: ["lifecycle"],
    _count: true,
  })
}
