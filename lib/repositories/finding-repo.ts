import { prisma } from "@/lib/infra/prisma"
import type { FindingStatus, Severity } from "@/lib/generated/prisma"

export async function findByProject(projectId: string) {
  return prisma.finding.findMany({
    where: { projectId },
    include: { pocs: true, asset: true },
    orderBy: { createdAt: "desc" },
  })
}

export async function findById(id: string) {
  return prisma.finding.findUnique({
    where: { id },
    include: { pocs: true, asset: true, evidence: true },
  })
}

export async function findSuspected(projectId: string) {
  return prisma.finding.findMany({
    where: { projectId, status: "suspected" },
  })
}

export async function create(data: {
  projectId: string
  assetId?: string
  evidenceId?: string
  severity: Severity
  title: string
  summary?: string
  affectedTarget?: string
  recommendation?: string
}) {
  return prisma.finding.create({
    data: {
      projectId: data.projectId,
      assetId: data.assetId,
      evidenceId: data.evidenceId,
      severity: data.severity,
      title: data.title,
      summary: data.summary ?? "",
      affectedTarget: data.affectedTarget ?? "",
      recommendation: data.recommendation ?? "",
    },
  })
}

export async function updateStatus(id: string, status: FindingStatus) {
  return prisma.finding.update({
    where: { id },
    data: { status },
  })
}

export async function createPoc(data: {
  findingId: string
  mcpRunId?: string
  code: string
  language: string
  executionOutput?: string
  succeeded?: boolean
  executedAt?: Date
}) {
  return prisma.poc.create({
    data: {
      findingId: data.findingId,
      mcpRunId: data.mcpRunId,
      code: data.code,
      language: data.language,
      executionOutput: data.executionOutput ?? "",
      succeeded: data.succeeded ?? false,
      executedAt: data.executedAt,
    },
  })
}

export async function countByProjectAndSeverity(projectId: string) {
  return prisma.finding.groupBy({
    by: ["severity", "status"],
    where: { projectId },
    _count: true,
  })
}
