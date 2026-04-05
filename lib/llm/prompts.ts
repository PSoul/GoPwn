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
  toolName: string
  target: string
  rawOutput: string
  existingAssets: Array<{ kind: AssetKind; value: string }>
  existingFindings?: Array<{ title: string; severity: string; affectedTarget: string }>
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
