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

/**
 * Normalize a finding title for dedup comparison.
 * Strips whitespace, punctuation variations, and common LLM rephrasing patterns.
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s\-_]+/g, " ")           // normalize whitespace/dashes
    .replace(/[（(].*?[)）]/g, "")        // strip parenthetical notes
    .replace(/漏洞|vulnerability|issue/gi, "")
    .trim()
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
  // De-duplicate: check exact match first, then fuzzy match on normalized title
  const target = data.affectedTarget ?? ""

  // Exact match
  let existing = await prisma.finding.findFirst({
    where: {
      projectId: data.projectId,
      title: data.title,
      affectedTarget: target,
    },
  })

  // Fuzzy match: find all findings for same target, compare normalized titles
  if (!existing) {
    const candidates = await prisma.finding.findMany({
      where: {
        projectId: data.projectId,
        affectedTarget: target,
      },
    })
    const normalizedNew = normalizeTitle(data.title)
    existing = candidates.find((c) => normalizeTitle(c.title) === normalizedNew) ?? null
  }

  if (existing) {
    // Only upgrade severity, never downgrade
    const severityRank: Record<string, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 }
    const shouldUpgrade = severityRank[data.severity] > severityRank[existing.severity]

    return prisma.finding.update({
      where: { id: existing.id },
      data: {
        ...(shouldUpgrade ? { severity: data.severity } : {}),
        ...(data.summary ? { summary: data.summary } : {}),
        ...(data.evidenceId ? { evidenceId: data.evidenceId } : {}),
      },
    })
  }

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
