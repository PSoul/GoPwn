import { prisma } from "@/lib/infra/prisma"

export async function findByProject(projectId: string, limit = 50) {
  return prisma.auditEvent.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
}

export async function findAll(limit = 100) {
  return prisma.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  })
}

export async function create(data: {
  projectId?: string
  category: string
  action: string
  actor: string
  detail?: string
}) {
  return prisma.auditEvent.create({
    data: {
      projectId: data.projectId,
      category: data.category,
      action: data.action,
      actor: data.actor,
      detail: data.detail ?? "",
    },
  })
}
