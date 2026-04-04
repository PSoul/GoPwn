/**
 * LLM prompt templates for all three roles: planner, analyzer, reviewer.
 *
 * Key principle: never give LLM specific exploit code or hardcoded port→service mappings.
 * Teach methodology, let it reason.
 */

import type { LlmMessage } from "./provider"
import type { PentestPhase, AssetKind } from "@/lib/generated/prisma"
import { PHASE_LABELS } from "@/lib/domain/phases"
import { loadSystemPrompt } from "./system-prompt"

// ── Types ──

export type PlannerContext = {
  projectName: string
  targets: Array<{ value: string; type: string }>
  currentPhase: PentestPhase
  round: number
  maxRounds: number
  availableTools: Array<{ toolName: string; capability: string; description: string }>
  assets: Array<{ kind: AssetKind; value: string; label: string }>
  findings: Array<{ title: string; status: string; severity: string }>
  previousRoundSummary?: string
}

export type AnalyzerContext = {
  projectName: string
  toolName: string
  target: string
  rawOutput: string
  existingAssets: Array<{ kind: AssetKind; value: string }>
}

export type ReviewerContext = {
  projectName: string
  currentPhase: PentestPhase
  round: number
  maxRounds: number
  roundSummary: string
  totalAssets: number
  totalFindings: number
  unverifiedFindings: number
}

export type VerifierContext = {
  projectName: string
  finding: { title: string; summary: string; severity: string; affectedTarget: string }
  evidence?: { rawOutput: string; toolName: string }
}

// ── Plan item schema (what we expect from LLM planner) ──

export type LlmPlanItem = {
  toolName: string
  target: string
  action: string
  rationale: string
  phase: PentestPhase
  riskLevel: "low" | "medium" | "high"
}

export type LlmPlanResponse = {
  summary: string
  phase: PentestPhase
  items: LlmPlanItem[]
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

export async function buildPlannerPrompt(ctx: PlannerContext): Promise<LlmMessage[]> {
  const systemPrompt = await loadSystemPrompt()
  const toolList = ctx.availableTools
    .map((t) => `- ${t.toolName} (${t.capability}): ${t.description}`)
    .join("\n")

  const assetList = ctx.assets.length > 0
    ? ctx.assets.map((a) => `  [${a.kind}] ${a.value} — ${a.label}`).join("\n")
    : "  (尚无已发现资产)"

  const findingList = ctx.findings.length > 0
    ? ctx.findings.map((f) => `  [${f.severity}/${f.status}] ${f.title}`).join("\n")
    : "  (尚无发现)"

  const phaseLabel = PHASE_LABELS[ctx.currentPhase]

  return [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `# 安全评估规划 — 第 ${ctx.round}/${ctx.maxRounds} 轮

## 项目: ${ctx.projectName}
## 当前阶段: ${phaseLabel} (${ctx.currentPhase})

## 测试目标
${ctx.targets.map((t) => `- [${t.type}] ${t.value}`).join("\n")}

## 已发现资产
${assetList}

## 已有发现
${findingList}

## 上轮摘要
${ctx.previousRoundSummary ?? "(首轮，无历史)"}

## 可用工具
${toolList}

## 你的任务
根据当前阶段和已有信息，规划本轮需要执行的探测任务。

请以 JSON 格式回复，结构如下：
\`\`\`json
{
  "summary": "本轮规划概述",
  "phase": "建议的当前阶段(recon|discovery|assessment|verification|reporting)",
  "items": [
    {
      "toolName": "工具名",
      "target": "目标地址或资产",
      "action": "具体操作描述",
      "rationale": "为什么要执行这个操作",
      "phase": "此操作属于哪个阶段",
      "riskLevel": "low|medium|high"
    }
  ]
}
\`\`\`

注意：
- 每轮最多规划 5 个任务，优先覆盖最重要的测试点
- 根据已有资产和发现避免重复探测
- 对非 HTTP 服务，先用 banner 探测确认协议类型
- riskLevel 为 high 的操作需要人工审批
- **重要**: target 字段必须是真实的网络地址（IP、IP:端口、URL、域名），绝不能使用描述性文字或中文占位符。正确示例: "127.0.0.1:6379"、"http://127.0.0.1:8080"。错误示例: "127.0.0.1:非HTTP端口"、"目标域名"
- toolName 必须完全匹配上面可用工具列表中的名称`,
    },
  ]
}

export async function buildAnalyzerPrompt(ctx: AnalyzerContext): Promise<LlmMessage[]> {
  const systemPrompt = await loadSystemPrompt()
  const existingAssets = ctx.existingAssets.length > 0
    ? ctx.existingAssets.map((a) => `  [${a.kind}] ${a.value}`).join("\n")
    : "  (无)"

  return [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `# 工具输出分析

## 项目: ${ctx.projectName}
## 工具: ${ctx.toolName}
## 目标: ${ctx.target}

## 已有资产（避免重复）
${existingAssets}

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

请以 JSON 格式回复：
\`\`\`json
{
  "assets": [
    {
      "kind": "domain|subdomain|ip|port|service|webapp|api_endpoint",
      "value": "标准化值",
      "label": "显示标签",
      "parentValue": "父级资产的value（可选）",
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

  return [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `# 轮次审查决策

## 项目: ${ctx.projectName}
## 当前阶段: ${phaseLabel} (${ctx.currentPhase})
## 轮次: ${ctx.round}/${ctx.maxRounds}

## 本轮统计
- 已发现资产总数: ${ctx.totalAssets}
- 安全发现总数: ${ctx.totalFindings}
- 待验证发现: ${ctx.unverifiedFindings}

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

判断依据：
- 如果还有明显未覆盖的攻击面，选择 continue
- 如果已发现的漏洞需要验证，推进到 verification 阶段
- 如果所有发现都已验证且攻击面已充分覆盖，选择 settle
- 如果已达到最大轮次的 80%，倾向于 settle
- 如果有待验证的发现，先 continue 到 verification`,
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
- 优先使用 JavaScript (Node.js)，因为执行环境是 Node
- 如果是 HTTP 类验证，用 fetch API
- 输出必须包含 { "verified": true/false, "detail": "..." }`,
    },
  ]
}

/**
 * Parse JSON from LLM response, handling markdown code blocks and preamble text.
 */
export function parseLlmJson<T>(text: string): T {
  // Try 1: extract from markdown code block anywhere in text
  const codeBlockMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/)
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim())
  }

  // Try 2: find the first { and last } to extract JSON object
  const firstBrace = text.indexOf("{")
  const lastBrace = text.lastIndexOf("}")
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(text.slice(firstBrace, lastBrace + 1))
  }

  // Try 3: parse the whole text as-is
  return JSON.parse(text.trim())
}
