import { listStoredAssets } from "@/lib/data/asset-repository"
import { listStoredEvidence } from "@/lib/data/evidence-repository"
import { listStoredProjectFindings } from "@/lib/project/project-results-repository"
import { listStoredMcpTools } from "@/lib/mcp/mcp-repository"
import { listBuiltInMcpTools } from "@/lib/mcp/built-in-mcp-tools"
import { prisma } from "@/lib/infra/prisma"
import { toOrchestratorRoundRecord, toMcpRunRecord } from "@/lib/infra/prisma-transforms"
import { getAgentConfig } from "@/lib/settings/agent-config"
import { summarizeToolOutput } from "@/lib/analysis/tool-output-summarizer"
import { analyzeFailure, formatFailureForPrompt } from "@/lib/analysis/failure-analyzer"
import type { OrchestratorRoundRecord, McpToolRecord } from "@/lib/prototype-types"

/** 粗略估算文本 token 数（中文约 1.5 char/token，英文约 4 char/token） */
function estimateTokenCount(text: string): number {
  const cjkChars = (text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length
  const otherChars = text.length - cjkChars
  return Math.ceil(cjkChars / 1.5 + otherChars / 4)
}

function formatSnapshotSection(label: string, items: string[], maxItems: number): string {
  if (items.length === 0) {
    return `${label}(0): 暂无`
  }

  const display = items.slice(0, maxItems)
  const suffix = items.length > maxItems ? ` (+${items.length - maxItems} more)` : ""

  return `${label}(${items.length}): ${display.join(", ")}${suffix}`
}

export async function buildAssetSnapshot(projectId: string): Promise<string> {
  const config = getAgentConfig()
  const maxPerType = config.context.assetSnapshotMaxPerType
  const assets = await listStoredAssets(projectId)
  const findings = await listStoredProjectFindings(projectId)

  const domains = assets
    .filter((a) => a.type === "domain")
    .map((a) => `${a.label} [${a.scopeStatus}]`)
  const hosts = assets
    .filter((a) => a.type === "host")
    .map((a) => a.label)
  const ports = assets
    .filter((a) => a.type === "port")
    .map((a) => a.label)
  const services = assets
    .filter((a) => a.type === "service")
    .map((a) => a.label)
  const entries = assets
    .filter((a) => a.type === "entry")
    .map((a) => a.label)
  const fingerprints = assets
    .filter((a) => a.type === "fingerprint")
    .map((a) => a.label)
  const vulns = findings.map((f) => `${f.title} [${f.severity}/${f.status}]`)

  return [
    formatSnapshotSection("域名", domains, maxPerType),
    formatSnapshotSection("主机", hosts, maxPerType),
    formatSnapshotSection("端口", ports, maxPerType),
    formatSnapshotSection("服务", services, maxPerType),
    formatSnapshotSection("Web入口", entries, maxPerType),
    formatSnapshotSection("指纹", fingerprints, Math.ceil(maxPerType / 2)),
    formatSnapshotSection("漏洞/发现", vulns, maxPerType),
  ].join("\n")
}

export function buildRoundSummary(projectId: string, round: OrchestratorRoundRecord): string {
  const parts = [
    `第${round.round}轮: 执行${round.executedCount}/${round.planItemCount}个动作`,
    `新增${round.newAssetCount}个资产/${round.newFindingCount}个发现`,
  ]

  if (round.failedActions.length > 0) {
    parts.push(`${round.failedActions.length}个失败`)
  }

  if (round.blockedByApproval.length > 0) {
    parts.push(`${round.blockedByApproval.length}个待审批`)
  }

  // 附加反思信息（如果有）
  if (round.reflection) {
    parts.push(`\n  反思: ${round.reflection.keyFindings}`)
    if (round.reflection.lessonsLearned !== "无失败") {
      parts.push(`\n  教训: ${round.reflection.lessonsLearned}`)
    }
    parts.push(`\n  方向: ${round.reflection.nextDirection}`)
  }

  return parts.join(", ")
}

export async function buildCompressedRoundHistory(projectId: string): Promise<string> {
  const config = getAgentConfig()
  const detailCount = config.context.roundHistoryDetailCount
  const dbRounds = await prisma.orchestratorRound.findMany({
    where: { projectId },
    orderBy: { round: "asc" },
  })
  const rounds = dbRounds.map(toOrchestratorRoundRecord)

  if (rounds.length === 0) {
    return "尚未执行过任何 AI 规划轮次。"
  }

  const lines: string[] = []

  if (rounds.length <= detailCount) {
    // All rounds get full summaries
    for (const round of rounds) {
      lines.push(buildRoundSummary(projectId, round))
    }
  } else {
    // Older rounds get compressed, recent N get full detail
    const olderRounds = rounds.slice(0, -detailCount)
    const recentRounds = rounds.slice(-detailCount)

    // Compress older rounds into groups of 3
    for (let i = 0; i < olderRounds.length; i += 3) {
      const group = olderRounds.slice(i, i + 3)
      const totalAssets = group.reduce((sum, r) => sum + r.newAssetCount, 0)
      const totalFindings = group.reduce((sum, r) => sum + r.newFindingCount, 0)
      const totalExecuted = group.reduce((sum, r) => sum + r.executedCount, 0)
      const roundRange = group.length === 1
        ? `第${group[0].round}轮`
        : `第${group[0].round}-${group[group.length - 1].round}轮`

      lines.push(`${roundRange}概要: 执行${totalExecuted}个动作, 新增${totalAssets}个资产/${totalFindings}个发现`)
    }

    // Recent 3 rounds get full summaries
    for (const round of recentRounds) {
      lines.push(buildRoundSummary(projectId, round))
    }
  }

  return lines.join("\n")
}

export async function buildLastRoundDetail(projectId: string): Promise<string> {
  const dbRuns = await prisma.mcpRun.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  })
  const runs = dbRuns.map(toMcpRunRecord)

  if (runs.length === 0) {
    return "上一轮没有执行记录。"
  }

  // Get the most recent runs (last 10)
  const recentRuns = runs.slice(-10)

  // 查找每个 run 对应的证据（包含原始输出）
  const evidence = await listStoredEvidence(projectId)

  const lines: string[] = []

  for (const run of recentRuns) {
    if (run.status === "已阻塞" || run.status === "已取消") {
      // 失败的 run: 使用失败分析器提供智能建议
      const errorMsg = run.summaryLines?.join(" ") || `工具 ${run.toolName} 执行失败`
      const analysis = analyzeFailure(run.toolName, run.target, errorMsg)
      lines.push(formatFailureForPrompt(analysis))
    } else {
      // 成功/其他状态的 run: 使用输出摘要 + 原始输出片段
      const relatedEvidence = evidence.find(
        (e) => e.linkedTaskTitle?.includes(run.toolName) || e.source?.includes(run.toolName),
      )
      const rawOutput = relatedEvidence?.rawOutput?.join("\n") ?? ""
      const summary = summarizeToolOutput(run.toolName, run.target, run.status, rawOutput)

      const statusIcon = summary.status === "成功" ? "✓" : "⏳"
      const findingsText = summary.keyFindings.length > 0
        ? summary.keyFindings.map(f => `  · ${f}`).join("\n")
        : "  · (无输出)"

      // 对于关键探测工具，附加截断的原始输出供 LLM 分析
      const isReconTool = ["httpx_probe", "httpx_tech_detect", "dirsearch_scan", "execute_code", "execute_command"].includes(run.toolName)
      const rawSnippet = isReconTool && rawOutput.length > 0
        ? `\n  原始输出片段: ${rawOutput.slice(0, 1500)}${rawOutput.length > 1500 ? "...(truncated)" : ""}`
        : ""
      lines.push(`${statusIcon} ${run.toolName}(${run.target})\n${findingsText}${rawSnippet}`)
    }
  }

  return lines.join("\n")
}

export async function buildUnusedCapabilities(projectId: string): Promise<string> {
  const dbRuns = await prisma.mcpRun.findMany({
    where: { projectId },
    select: { capability: true },
  })
  const usedCapabilities = new Set(dbRuns.map((r) => r.capability))

  const allTools = [...(await listStoredMcpTools()), ...listBuiltInMcpTools()].filter(
    (t) => t.status === "启用",
  )
  const allCapabilities = new Set(allTools.map((t) => t.capability))

  const unused = Array.from(allCapabilities).filter((c) => !usedCapabilities.has(c))

  if (unused.length === 0) {
    return "所有已注册的能力类型都已在本项目中使用过。"
  }

  return unused.map((cap) => {
    const tools = allTools.filter((t) => t.capability === cap)
    return `- ${cap} (${tools.map((t) => t.toolName).join(", ")})`
  }).join("\n")
}

/**
 * 基于 token 预算的上下文压缩。
 * 当上下文接近 LLM token 限制时，自动压缩各个部分。
 */
function compressContextByBudget(sections: { label: string; content: string }[]): string {
  const config = getAgentConfig()
  const budget = Math.floor(config.context.maxContextTokens * (config.context.compressionThresholdPercent / 100))

  const totalTokens = sections.reduce((sum, s) => sum + estimateTokenCount(s.content), 0)

  if (totalTokens <= budget) {
    // 未超过预算，直接拼接
    return sections.map((s) => `[${s.label}]\n${s.content}`).join("\n\n")
  }

  // 超过预算: 按优先级压缩（历史轮次 > 资产快照 > 上一轮详情 > 未使用能力）
  // 优先保留最近信息，压缩历史
  const compressed = sections.map((s) => {
    const sectionTokens = estimateTokenCount(s.content)
    if (sectionTokens > budget / sections.length) {
      // 此部分占比过大，截断
      const targetChars = Math.floor((budget / sections.length) * 2) // 粗略 token:char = 1:2
      const truncated = s.content.slice(0, targetChars)
      return { label: s.label, content: truncated + "\n...[已压缩]" }
    }
    return s
  })

  return compressed.map((s) => `[${s.label}]\n${s.content}`).join("\n\n")
}

/**
 * Build a summary of tools that have failed repeatedly across rounds.
 * LLM should avoid re-scheduling these tools.
 */
export async function buildFailedToolsSummary(projectId: string): Promise<string> {
  const dbTasks = await prisma.schedulerTask.findMany({
    where: { projectId, status: "failed" },
    select: { toolName: true, target: true, lastError: true },
  })

  if (dbTasks.length === 0) return ""

  // Group by toolName and count failures
  const failMap = new Map<string, { count: number; error: string }>()
  for (const t of dbTasks) {
    const key = t.toolName
    const existing = failMap.get(key)
    if (existing) {
      existing.count += 1
    } else {
      // Extract short error reason
      const shortError = (t.lastError ?? "未知错误").split(" / ")[0].slice(0, 80)
      failMap.set(key, { count: 1, error: shortError })
    }
  }

  // Only report tools that failed 2+ times (not one-off transient errors)
  const lines: string[] = []
  for (const [tool, info] of failMap) {
    if (info.count >= 2) {
      lines.push(`- ${tool}: 已失败 ${info.count} 次。原因: ${info.error}`)
    }
  }

  return lines.join("\n")
}

export function buildMultiRoundBrainPrompt(input: {
  projectName: string
  targetInput: string
  targets: string[]
  description: string
  currentStage: string
  currentRound: number
  maxRounds: number
  autoReplan: boolean
  assetCount: number
  evidenceCount: number
  findingCount: number
  pendingApprovals: number
  roundHistory: string
  assetSnapshot: string
  lastRoundDetail: string
  unusedCapabilities: string
  failedToolsSummary?: string
  availableTools: Pick<McpToolRecord, "boundary" | "capability" | "requiresApproval" | "riskLevel" | "toolName">[]
  note?: string
}): string {
  const formatToolLine = (tool: typeof input.availableTools[number]) =>
    `- capability=${tool.capability}; tool=${tool.toolName}; risk=${tool.riskLevel}; boundary=${tool.boundary}; approval=${tool.requiresApproval ? "required" : "optional"}`

  const targets = input.targets.length > 0
    ? input.targets.map((t) => `- ${t}`).join("\n")
    : input.targetInput.trim() || "- (empty)"

  return [
    `当前是第 ${input.currentRound} 轮 AI 规划（共最多 ${input.maxRounds} 轮）。请基于已有结果决定下一步。`,
    "",
    `项目名称：${input.projectName}`,
    `当前阶段：${input.currentStage}`,
    `项目说明：${input.description || "无"}`,
    `目标列表：\n${targets}`,
    `自动续跑：${input.autoReplan ? "开启" : "关闭"}`,
    "",
    `当前结果摘要：资产=${input.assetCount}; 证据=${input.evidenceCount}; 漏洞/发现=${input.findingCount}; 待审批=${input.pendingApprovals}`,
    "",
    compressContextByBudget([
      { label: "历史轮次摘要", content: input.roundHistory },
      { label: "当前资产画像", content: input.assetSnapshot },
      { label: "上一轮执行详情", content: input.lastRoundDetail },
      { label: "尚未使用的能力", content: input.unusedCapabilities },
    ]),
    "",
    input.note ? `研究员备注：${input.note}` : "",
    "",
    "当前可用 MCP 能力与工具：",
    ...input.availableTools.map(formatToolLine),
    "",
    input.failedToolsSummary ? `\n[持续失败的工具 — 请勿再次调度]\n${input.failedToolsSummary}` : "",
    "",
    "输出要求：",
    "- 不要重复已经成功执行过的相同动作（相同工具+相同目标）。",
    "- 不要调度上面列出的「持续失败的工具」，除非你有明确理由认为失败原因已解决。",
    "- 优先覆盖尚未使用的能力维度。",
    "- 默认给出 3 到 6 条 item。",
    "- 可以包含后续需要审批的动作，但只有在低风险结果已经支撑它时才允许出现高风险动作。",
    "- 范围约束：只能围绕项目输入目标本身及其子域展开。",
    "- target 格式：tcp_connect 和 tcp_banner_grab 的 target 必须为 host:port 格式（如 1.2.3.4:443）；要探测多个端口请拆分为多条 item。",
    "",
    "**禁止在 0 findings 时提前收尾**（最高优先级规则）：",
    `- 当前漏洞/发现数量为 ${input.findingCount}。`,
    input.findingCount === 0
      ? "- **你的漏洞/发现数量为 0，这意味着你还没有做任何主动漏洞测试。你绝对不能返回 items: [] 收尾！**"
      : "",
    "- 如果漏洞/发现数量为 0，**绝对禁止**返回 items: [] 收尾，无论你认为信息收集是否充分。",
    "- 0 findings 说明你还没有做主动漏洞测试。你必须安排 execute_code 进行主动验证（SQLi/XSS/命令注入/未授权访问等）。",
    "- Web 应用目标必须至少经过一轮 execute_code 主动漏洞测试才允许收尾。",
    "- 典型的渗透测试流程：第 1 轮信息收集 → 第 2-3 轮主动漏洞测试（execute_code）→ 第 4-5 轮深度验证或收尾。",
    "- 如果前几轮只做了信息收集（httpx_probe/dirsearch_scan 等），你现在必须进入主动测试阶段。",
    "",
    "收敛原则（在满足上述 0 findings 规则后生效）：",
    "- 只有当 findings > 0 且已完成主动漏洞测试后，才可以返回 items: [] 并在 summary 中说明收尾原因。",
    "- 单个目标通常 3-5 轮足够完成全部信息收集和漏洞验证，不要为了凑轮次而重复低价值动作。",
    "- 已经超时或失败过的工具，再次调度大概率仍会失败，不要浪费轮次。",
    "- 质量优先于覆盖面：一个有效发现胜过十个失败的探测。",
  ].filter(Boolean).join("\n")
}
