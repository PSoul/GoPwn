/**
 * LLM prompt templates for analyzer, reviewer, and verifier roles.
 *
 * Key principle: never give LLM specific exploit code or hardcoded port→service mappings.
 * Teach methodology, let it reason.
 *
 * NOTE: Planner prompt (buildPlannerPrompt) has been replaced by ReAct system prompt
 * in react-prompt.ts. PlannerContext/LlmPlanResponse removed.
 */

import type { LlmMessage } from "./provider"
import type { PentestPhase, AssetKind } from "@/lib/generated/prisma"
import { PHASE_LABELS } from "@/lib/domain/phases"
import { loadSystemPrompt } from "./system-prompt"

// ── Types ──

export type AnalyzerContext = {
  projectName: string
  projectDescription?: string
  scopeTargets?: string[]
  toolName: string
  target: string
  rawOutput: string
  existingAssets: Array<{ kind: AssetKind; value: string }>
  existingFindings?: Array<{ title: string; severity: string; affectedTarget: string }>
}

export type ReviewerContext = {
  projectName: string
  projectDescription?: string
  currentPhase: PentestPhase
  round: number
  maxRounds: number
  roundSummary: string
  totalAssets: number
  totalFindings: number
  unverifiedFindings: number
  /** 已确认的 high/critical 级别 finding 数量 */
  confirmedHighFindings: number
  /** 本轮新增的 finding 数量（去重后净增） */
  newFindingsThisRound: number
  /** 连续多少轮没有新增已确认 finding */
  roundsWithoutNewFindings: number
  /** 按严重性分组的 finding 统计 */
  findingsBySeverity?: Record<string, number>
}

export type VerifierContext = {
  projectName: string
  finding: { title: string; summary: string; severity: string; affectedTarget: string }
  evidence?: { rawOutput: string; toolName: string }
}

// ── Analyzer output schema ──

export type LlmAnalysisResult = {
  assets: Array<{
    kind: AssetKind
    value: string
    label: string
    parentValue?: string
    fingerprints?: Array<{ category: string; value: string }>
  }>
  findings: Array<{
    title: string
    severity: "critical" | "high" | "medium" | "low" | "info"
    summary: string
    affectedTarget: string
    recommendation: string
  }>
  evidenceSummary: string
}

// ── Reviewer output schema ──

export type LlmReviewDecision = {
  decision: "continue" | "settle"
  nextPhase?: PentestPhase
  reasoning: string
}

// ── Verifier output schema ──

export type LlmPocCode = {
  code: string
  language: "javascript" | "python" | "http"
  description: string
}

// ── Prompt builders ──

export async function buildAnalyzerPrompt(ctx: AnalyzerContext): Promise<LlmMessage[]> {
  const systemPrompt = await loadSystemPrompt()
  const existingAssets = ctx.existingAssets.length > 0
    ? ctx.existingAssets.map((a) => `  [${a.kind}] ${a.value}`).join("\n")
    : "  (无)"

  const existingFindings = (ctx.existingFindings ?? []).length > 0
    ? ctx.existingFindings!.map((f) => `  [${f.severity}] ${f.title} → ${f.affectedTarget}`).join("\n")
    : "  (无)"

  const scopeTargetList = (ctx.scopeTargets ?? []).length > 0
    ? ctx.scopeTargets!.map((t) => `  - ${t}`).join("\n")
    : ""

  const projectContext = [
    `## 项目: ${ctx.projectName}`,
    ctx.projectDescription ? `## 项目说明: ${ctx.projectDescription}` : "",
    scopeTargetList ? `## 授权目标\n${scopeTargetList}` : "",
    `## 工具: ${ctx.toolName}`,
    `## 目标: ${ctx.target}`,
  ].filter(Boolean).join("\n")

  return [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `# 工具输出分析

${projectContext}

## 已有资产（避免重复）
${existingAssets}

## 已有发现（避免重复！如果下面的发现已覆盖同类问题，请勿再次报告）
${existingFindings}

## 工具原始输出
\`\`\`
${ctx.rawOutput.slice(0, 15_000)}
\`\`\`
${ctx.rawOutput.length > 15_000 ? `\n(输出已截断，原始长度 ${ctx.rawOutput.length} 字符)` : ""}

## 你的任务
从工具输出中提取：
1. **新发现的资产**（域名、IP、端口、服务、Web应用、API端点等）
2. **安全发现**（漏洞、配置问题、信息泄露等）
3. **证据摘要**（对这次工具执行结果的总结）

### 资产提取的关联性要求
只提取与项目目标**有关联**的资产：
- **提取**：目标的子域名、同网段 IP、同一组织的关联域名（如子公司、收购品牌）、目标服务器上发现的端口/服务/路径
- **不提取**：第三方 CDN 域名（如 cloudflare.com、akamai.com）、通用 SaaS 服务域名、与项目目标所属组织无关的外部地址
- 判断依据：参考上方的项目说明和授权目标，如果项目说明中指明了组织名称，则该组织的已知关联资产属于合理范围

请以 JSON 格式回复：
\`\`\`json
{
  "assets": [
    {
      "kind": "domain|subdomain|ip|port|service|webapp|api_endpoint",
      "value": "标准化值",
      "label": "显示标签",
      "parentValue": "父级资产的value（可选）",
      "relevance": "与项目目标的关联说明（可选，对非直接子域名/同IP的资产建议填写）",
      "fingerprints": [{"category": "protocol|product|version|framework", "value": "指纹值"}]
    }
  ],
  "findings": [
    {
      "title": "发现标题",
      "severity": "critical|high|medium|low|info",
      "summary": "详细描述",
      "affectedTarget": "受影响的目标URL或地址",
      "recommendation": "修复建议"
    }
  ],
  "evidenceSummary": "本次探测结果的简要总结"
}
\`\`\`

注意：
- 只提取工具输出中实际存在的信息，不要编造
- severity 评估要准确，不夸大
- 对于不确定的发现，标记为 info 级别`,
    },
  ]
}

export async function buildReviewerPrompt(ctx: ReviewerContext): Promise<LlmMessage[]> {
  const systemPrompt = await loadSystemPrompt()
  const phaseLabel = PHASE_LABELS[ctx.currentPhase]

  // 构建 severity 统计摘要
  const severityStats = ctx.findingsBySeverity
    ? Object.entries(ctx.findingsBySeverity).map(([sev, cnt]) => `${sev}: ${cnt}`).join(", ")
    : ""

  return [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `# 轮次审查决策

## 项目: ${ctx.projectName}${ctx.projectDescription ? `\n## 项目说明: ${ctx.projectDescription}` : ""}
## 当前阶段: ${phaseLabel} (${ctx.currentPhase})
## 轮次: ${ctx.round}/${ctx.maxRounds}

## 本轮统计
- 已发现资产总数: ${ctx.totalAssets}
- 安全发现总数: ${ctx.totalFindings}${severityStats ? ` (${severityStats})` : ""}
- 已确认高危/严重发现: ${ctx.confirmedHighFindings}
- 本轮新增发现: ${ctx.newFindingsThisRound}
- 连续无新增发现的轮数: ${ctx.roundsWithoutNewFindings}

## 本轮执行摘要
${ctx.roundSummary}

## 你的任务
决定是继续下一轮探测还是结束评估。

请以 JSON 格式回复：
\`\`\`json
{
  "decision": "continue|settle",
  "nextPhase": "如果继续，建议的下一阶段(recon|discovery|assessment|verification|reporting)",
  "reasoning": "决策理由"
}
\`\`\`

## 判断依据（按优先级排列）

**必须 settle 的情况（满足任一即 settle）：**
1. 已达到最大轮次的 80%（当前 ${ctx.round}/${ctx.maxRounds}，阈值 ${Math.ceil(ctx.maxRounds * 0.8)}）
2. 连续 2 轮以上没有新增发现（当前连续 ${ctx.roundsWithoutNewFindings} 轮无新增），说明攻击面已收敛
3. 已确认高危发现 ≥ 3 个且本轮无新增发现，说明主要漏洞已定位

**应该 settle 的情况：**
4. 当前阶段已到 reporting 或 verification 后期，说明测试充分
5. 项目说明中列出的服务均已测试覆盖，且无新攻击面

**应该 continue 的情况：**
6. 项目说明中明确列出的服务还有未深入测试的（对照已有发现，看哪些服务只做了端口识别但没做漏洞验证）
7. 本轮发现了全新的攻击面（新服务类型、新应用），值得深入
8. 已知存在弱口令类漏洞的服务（如 Tomcat、MySQL、SSH）还没尝试过弱口令测试

**重要原则：**
- "待验证发现数量多"**不是**继续的理由——这只说明分析器产生了很多疑似项，不代表需要更多轮次
- 同一漏洞被重复报告多次（如 Redis 未授权、ES 未授权）不应作为"还有工作要做"的理由
- 质量优于数量：3 个已确认的高危发现比 80 个待验证的 info 级发现更有价值
- 渗透测试的目标是发现关键风险，不是穷举所有可能`,
    },
  ]
}

export async function buildVerifierPrompt(ctx: VerifierContext): Promise<LlmMessage[]> {
  const systemPrompt = await loadSystemPrompt()
  return [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `# PoC 验证代码生成

## 项目: ${ctx.projectName}

## 待验证发现
- 标题: ${ctx.finding.title}
- 严重性: ${ctx.finding.severity}
- 描述: ${ctx.finding.summary}
- 目标: ${ctx.finding.affectedTarget}

${ctx.evidence ? `## 原始证据
工具: ${ctx.evidence.toolName}
输出:
\`\`\`
${ctx.evidence.rawOutput.slice(0, 5000)}
\`\`\`` : ""}

## 你的任务
生成一段可以验证此漏洞是否真实存在的 PoC 代码。

请以 JSON 格式回复：
\`\`\`json
{
  "code": "验证代码（完整可执行）",
  "language": "javascript|python|http",
  "description": "这段代码做了什么，预期的成功/失败标志"
}
\`\`\`

要求：
- 代码必须安全、非破坏性
- 代码必须有明确的成功/失败输出（JSON 格式）
- **必须使用 JavaScript (Node.js)**，只能使用 Node.js 内建模块（net, http, https, dns, crypto, fs, child_process 等），**不能 require 任何第三方 npm 包**（如 mysql2, pg, mongodb, ssh2 等都不可用）
- 如果是 HTTP 类验证，用 Node.js 内建的 fetch API 或 http 模块
- 对于 TCP 协议验证（MySQL、Redis、MongoDB 等），使用 net 模块的 Socket 直接发送协议数据
- 输出必须包含 { "verified": true/false, "detail": "..." }
- **端口号必须严格使用目标地址中的端口**（例如目标是 127.0.0.1:13306 就连 13306，不要用默认端口 3306）
- 如果目标地址格式是 "127.0.0.1 (SSH)" 这样不含端口号，需要参考原始证据中工具输出的端口信息`,
    },
  ]
}

/**
 * Parse JSON from LLM response with tolerance for common formatting issues:
 * - Markdown code fences (```json ... ```)
 * - Trailing commas before } or ]
 * - Extra text before/after JSON
 */
export function parseLlmJson<T>(text: string): T {
  let cleaned = text.trim()

  // Strip markdown code fence
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "")
  cleaned = cleaned.trim()

  // Try direct parse first (fast path)
  try {
    return JSON.parse(cleaned)
  } catch {
    // continue to recovery attempts
  }

  // Remove trailing commas before } or ]
  const noTrailingComma = cleaned.replace(/,\s*([\]}])/g, "$1")
  try {
    return JSON.parse(noTrailingComma)
  } catch {
    // continue
  }

  // Try to extract first JSON object from mixed text
  const objMatch = cleaned.match(/\{[\s\S]*\}/)
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0])
    } catch {
      try {
        return JSON.parse(objMatch[0].replace(/,\s*([\]}])/g, "$1"))
      } catch {
        // continue
      }
    }
  }

  // Try to extract JSON array
  const arrMatch = cleaned.match(/\[[\s\S]*\]/)
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0])
    } catch {
      // continue
    }
  }

  throw new Error(
    `LLM JSON 解析失败，所有恢复尝试均失败。\n原始内容前 500 字符: ${text.slice(0, 500)}`,
  )
}
