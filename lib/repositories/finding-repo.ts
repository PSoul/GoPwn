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
 * Strips whitespace, punctuation, and maps common Chinese↔English equivalents.
 */
function normalizeTitle(title: string): string {
  let t = title.toLowerCase()

  // Map common Chinese terms to English equivalents for cross-language dedup
  const zhEnMap: [RegExp, string][] = [
    [/cookie\s*安全属性缺失|cookie\s*security\s*attributes?\s*missing/gi, "cookie-no-secure-flag"],
    [/服务器?版本[信息]?暴露|server\s*version\s*(info(rmation)?\s*)?disclos(ure|ed)|server\s*header\s*leak/gi, "server-version-disclosure"],
    [/目录(浏览|列举|遍历)|directory\s*(listing|browsing|traversal)/gi, "directory-listing"],
    [/信息泄[露漏]|information\s*(disclos(ure|ed)|leak(age)?)/gi, "info-disclosure"],
    [/缺少.*安全头|missing\s*security\s*headers?|安全头[缺未].*配置/gi, "missing-security-headers"],
    [/x-frame-options\s*(缺失|missing|未设置)/gi, "missing-x-frame-options"],
    [/x-content-type-options\s*(缺失|missing|未设置)/gi, "missing-x-content-type-options"],
    [/弱口令|weak\s*password|弱密码|default\s*(credential|password)/gi, "weak-password"],
    [/未授权访问|unauth(orized|enticated)\s*access/gi, "unauthorized-access"],
    [/sql\s*注入|sql\s*injection/gi, "sql-injection"],
    [/跨站脚本|xss|cross[- ]site\s*scripting/gi, "xss"],
    [/http\s*only.*cookie|cookie.*http\s*only/gi, "cookie-no-httponly"],
  ]

  for (const [re, replacement] of zhEnMap) {
    if (re.test(t)) {
      t = replacement
      break
    }
  }

  return t
    .replace(/[\s\-_]+/g, " ")
    .replace(/[（(].*?[)）]/g, "")
    .replace(/漏洞|vulnerability|issue/gi, "")
    .trim()
}

/** Extract root host from an affectedTarget (strip path, port) for broader dedup matching */
function extractRootHost(target: string): string {
  try {
    const url = new URL(target.startsWith("http") ? target : `http://${target}`)
    return url.hostname
  } catch {
    return target.split("/")[0].split(":")[0]
  }
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

  // Fuzzy match: find ALL findings in the project, compare normalized titles
  // Match by (normalized title + root host) rather than (exact title + exact path)
  if (!existing) {
    const candidates = await prisma.finding.findMany({
      where: { projectId: data.projectId },
    })
    const normalizedNew = normalizeTitle(data.title)
    const rootHost = extractRootHost(target)
    existing = candidates.find((c) => {
      const sameTitle = normalizeTitle(c.title) === normalizedNew
      const sameHost = extractRootHost(c.affectedTarget) === rootHost
      return sameTitle && sameHost
    }) ?? null
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
