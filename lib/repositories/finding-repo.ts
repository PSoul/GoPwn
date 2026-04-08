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

// 停用词——出现频率高但无区分意义的词
const STOP_WORDS = new Set([
  // 中文停用词
  "的", "了", "在", "是", "与", "和", "或", "及", "被", "可", "已", "未", "为",
  "到", "从", "上", "中", "下", "有", "无", "且", "但", "等", "将", "对", "由",
  "此", "该", "其", "需", "应", "可能", "存在", "发现", "检测", "确认",
  "导致", "证据", "补强", "增量", "直接", "疑似",
  // 英文停用词
  "the", "a", "an", "is", "are", "was", "were", "be", "been",
  "has", "have", "had", "do", "does", "did", "will", "would",
  "can", "could", "may", "might", "shall", "should",
  "and", "or", "but", "if", "not", "no", "nor",
  "for", "with", "without", "by", "at", "on", "in", "to", "of", "from",
  "that", "this", "it", "its", "via",
])

/**
 * 通用分词：将 finding title 拆分为有意义的 token 集合。
 * 英文按单词，中文用 bigram（相邻两字组合）确保子串可匹配。
 * 同义词归一化确保语义等价。
 */
function tokenize(title: string): Set<string> {
  const t = title.toLowerCase()

  // 同义词归一化（语义等价的表述统一化）
  const synonyms: [RegExp, string][] = [
    [/未授权|未认证|未鉴权|匿名访问|匿名可读|匿名可写|匿名读写|免密/g, "未授权"],
    [/弱口令|弱密码|默认密码|默认凭据/g, "弱口令"],
    [/信息泄露|信息泄漏|信息暴露/g, "信息泄露"],
  ]

  let normalized = t
  for (const [re, replacement] of synonyms) {
    normalized = normalized.replace(re, replacement)
  }

  const tokens = new Set<string>()

  // 英文单词（保留技术术语如 phpmyadmin, elasticsearch, redis 等）
  for (const m of normalized.matchAll(/[a-z][a-z0-9_.-]{1,}/g)) {
    if (!STOP_WORDS.has(m[0])) tokens.add(m[0])
  }

  // 中文 bigram：把连续汉字段按每 2 字切分
  // "未授权访问" → {"未授", "授权", "权访", "访问"}
  // "未授权高危访问" → {"未授", "授权", "权高", "高危", "危访", "访问"}
  // 这样两者共享 "未授", "授权", "访问"，确保相似度高
  for (const m of normalized.matchAll(/[\u4e00-\u9fff]+/g)) {
    const chars = m[0]
    for (let i = 0; i < chars.length - 1; i++) {
      const bigram = chars[i] + chars[i + 1]
      if (!STOP_WORDS.has(bigram)) tokens.add(bigram)
    }
  }

  return tokens
}

/**
 * 计算两个 token 集合的相似度。
 * 使用「短集合覆盖率」而非 Jaccard：短的那个集合有多大比例被长的包含。
 * 这样 "Redis 未授权访问"(5 tokens) 和 "Redis 默认用户免密且具备全命令权限（未授权高危访问）"(19 tokens)
 * 短集合覆盖率 = 4/5 = 0.8（redis, 未授, 授权, 访问 都在长集合中）
 * 同时要求英文技术词（服务名等）匹配，防止不同服务的中文描述误匹配。
 */
function tokenSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  if (a.size === 0 || b.size === 0) return 0

  // 确保 small 是较短的集合
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]

  let overlap = 0
  let englishOverlap = 0
  let englishTotal = 0

  for (const t of small) {
    const isEnglish = /^[a-z]/.test(t)
    if (isEnglish) englishTotal++
    if (large.has(t)) {
      overlap++
      if (isEnglish) englishOverlap++
    }
  }

  const coverage = overlap / small.size

  // 如果有英文技术词但没有一个匹配 → 不同服务/产品，不去重
  if (englishTotal > 0 && englishOverlap === 0) return 0

  // 互斥英文 token 守卫：如果双方都有对方不包含的英文 token → 很可能是不同服务/产品
  // 例如 "mysql unauthorized access" vs "postgresql unauthorized access"
  //   → small 独有 "mysql"，large 独有 "postgresql" → 不同服务，拒绝合并
  if (englishTotal > 0 && englishOverlap < englishTotal) {
    let largeOnlyEnglish = 0
    for (const t of large) {
      if (/^[a-z]/.test(t) && !small.has(t)) largeOnlyEnglish++
    }
    if (largeOnlyEnglish > 0) return 0
  }

  return coverage
}

/**
 * Normalize a finding title for dedup comparison.
 * Strips whitespace, punctuation, and maps common Chinese↔English equivalents.
 */
function normalizeTitle(title: string): string {
  let t = title.toLowerCase()

  // 中英文漏洞类型同义词归一化（仅替换匹配部分，保留标题中的服务名等上下文）
  // IMPORTANT: Do NOT use /g flag here — .test() on a /g regex retains lastIndex
  // across calls, causing intermittent match failures on subsequent normalizeTitle() invocations.
  // IMPORTANT: 使用 t.replace(re, replacement) 而非 t = replacement，
  // 只替换匹配到的漏洞类型部分，保留服务名等区分信息。
  // 例如 "Redis 未授权访问" → "redis unauthorized-access"（保留 redis）
  //      "MongoDB 未授权访问" → "mongodb unauthorized-access"（保留 mongodb）
  const zhEnMap: [RegExp, string][] = [
    [/cookie\s*安全属性缺失|cookie\s*security\s*attributes?\s*missing/i, "cookie-no-secure-flag"],
    [/服务器?版本[信息]?暴露|server\s*version\s*(info(rmation)?\s*)?disclos(ure|ed)|server\s*header\s*leak/i, "server-version-disclosure"],
    [/目录(浏览|列举|遍历)|directory\s*(listing|browsing|traversal)/i, "directory-listing"],
    [/信息泄[露漏]|information\s*(disclos(ure|ed)|leak(age)?)/i, "info-disclosure"],
    [/缺少.*安全头|missing\s*security\s*headers?|安全头[缺未].*配置/i, "missing-security-headers"],
    [/x-frame-options\s*(缺失|missing|未设置)/i, "missing-x-frame-options"],
    [/x-content-type-options\s*(缺失|missing|未设置)/i, "missing-x-content-type-options"],
    [/弱口令|weak\s*password|弱密码|default\s*(credential|password)/i, "weak-password"],
    [/未授权访问|unauth(orized|enticated)\s*access/i, "unauthorized-access"],
    [/sql\s*注入|sql\s*injection/i, "sql-injection"],
    [/跨站脚本|xss|cross[- ]site\s*scripting/i, "xss"],
    [/http\s*only.*cookie|cookie.*http\s*only/i, "cookie-no-httponly"],
  ]

  for (const [re, replacement] of zhEnMap) {
    if (re.test(t)) {
      t = t.replace(re, replacement)
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
    const newTokens = tokenize(data.title)
    const rootHost = extractRootHost(target)

    // 找相似度最高的候选
    let bestMatch: typeof candidates[0] | null = null
    let bestScore = 0

    for (const c of candidates) {
      const sameHost = extractRootHost(c.affectedTarget) === rootHost

      // Tier 1: normalized title exact match + same host
      if (normalizeTitle(c.title) === normalizedNew && sameHost) {
        bestMatch = c
        break
      }

      // Tier 2: Jaccard 相似度 — 通用分词后比较 token 重叠度
      // 同主机 + 相似度 ≥ 0.7 = 高概率同一 finding
      // 0.7 阈值确保纯中文不同服务（如"数据库未授权访问" vs "缓存未授权访问"，0.67）不会被误合并
      if (sameHost && newTokens.size >= 2) {
        const existingTokens = tokenize(c.title)
        if (existingTokens.size >= 2) {
          const score = tokenSimilarity(newTokens, existingTokens)
          if (score >= 0.7 && score > bestScore) {
            bestScore = score
            bestMatch = c
          }
        }
      }
    }

    existing = bestMatch
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
