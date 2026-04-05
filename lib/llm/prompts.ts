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
  previousRoundDetails?: Array<{
    toolName: string
    target: string
    status: string
    rawOutput?: string
    error?: string
  }>
}

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
  strategy: string
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

function formatPreviousRound(ctx: PlannerContext): string {
  if (ctx.previousRoundDetails && ctx.previousRoundDetails.length > 0) {
    return ctx.previousRoundDetails.map((run) => {
      const icon = run.status === "succeeded" ? "✓" : "✗"
      const output = run.rawOutput
        ? `\n  原始输出:\n${run.rawOutput}`
        : run.error
          ? `\n  错误: ${run.error}`
          : ""
      return `### ${icon} ${run.toolName}(${run.target}) — ${run.status}${output}`
    }).join("\n\n")
  }
  return ctx.previousRoundSummary ?? "(首轮，无历史)"
}

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

## 上轮执行结果
${formatPreviousRound(ctx)}

## 可用工具
${toolList}

## 你的任务

### 第一步：策略思考（必须）
在列出具体任务之前，先分析当前局势：
1. **进展评估**：当前第 ${ctx.round}/${ctx.maxRounds} 轮，已有哪些信息？上轮哪些成功/失败？
2. **阶段判断**：根据已有信息，当前应处于哪个阶段？是否该推进到下一阶段？
3. **深入方向**：哪些已有发现值得深入利用？（例如：发现了登录页→尝试弱口令；发现了版本号→搜索已知CVE；发现了开放服务→尝试未授权访问）
4. **避免重复**：上轮已经做过的事情不要重复，失败的方法要换新思路

### 阶段推进指南
- **recon（1-2轮）**：端口扫描、banner抓取、目录扫描、技术栈识别。如果已有足够资产信息，应推进到 discovery
- **discovery（2-4轮）**：深入Web结构、API发现、认证分析、参数探测。如果已有攻击面地图，应推进到 assessment
- **assessment（3-7轮）**：**主动测试漏洞**——SQL注入、XSS、命令注入、弱口令、未授权访问、SSRF。这是发现真正漏洞的阶段！
- **verification（7-9轮）**：验证已发现的疑似漏洞，收集PoC证据
- **reporting（10轮）**：输出最终报告

**关键：不要在 recon/discovery 阶段停留太久！** 如果已有足够的资产和攻击面信息，必须推进到 assessment 阶段开始主动测试。10 轮测试中，至少有 4 轮应该在 assessment 或更高阶段。

### 从发现到利用的推理
当你发现以下信息时，应主动安排对应的后续测试：
- 发现登录页 → 尝试常见弱口令组合（通过 execute_code 或 http_raw_request）
- 发现数据库服务（MySQL/Redis/MongoDB）→ 测试未授权访问或默认凭据
- 发现版本号 → 分析是否有已知漏洞
- 发现表单/参数 → 测试注入类漏洞（SQL注入、XSS、命令注入）
- 发现 API 端点 → 测试越权访问、参数篡改
- 发现管理面板 → 测试默认凭据、绕过认证

### 第二步：输出 JSON
请以 JSON 格式回复，结构如下：
\`\`\`json
{
  "strategy": "当前策略思考：分析局势、判断阶段、选择攻击方向（2-3句话）",
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

### 规则
- 每轮最多规划 5 个任务，优先覆盖最重要的测试点
- 根据已有资产和发现避免重复探测
- 对非 HTTP 服务，先用 banner 探测确认协议类型
- riskLevel 为 high 的操作需要人工审批
- **重要**: target 字段必须是真实的网络地址（IP、IP:端口、URL、域名），绝不能使用描述性文字或中文占位符。正确示例: "127.0.0.1:6379"、"http://127.0.0.1:8080"。错误示例: "127.0.0.1:非HTTP端口"、"目标域名"
- toolName 必须完全匹配上面可用工具列表中的名称
- action 字段用于描述具体操作，平台会根据工具的 inputSchema 自动映射参数。你只需提供 toolName、target 和自然语言 action 即可
- **例外: execute_code 工具** — 当 toolName 为 execute_code 时，action 字段必须包含**可直接执行的 JavaScript 代码**（不是自然语言描述）。代码应输出 JSON 格式结果到 stdout。示例格式:
  \`\`\`
  const http = require('http'); const req = http.get('目标URL', (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>console.log(JSON.stringify({status:res.statusCode,headers:res.headers,body:d.slice(0,2000)}))); }); req.on('error',e=>console.log(JSON.stringify({error:e.message}))); req.setTimeout(10000,()=>{req.destroy();console.log(JSON.stringify({error:'timeout'}))});
  \`\`\`
  对于 TCP 服务，使用 net 模块连接并读取 banner。代码必须是合法的 Node.js 且能独立运行。`,
    },
  ]
}

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
