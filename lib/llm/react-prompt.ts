/**
 * ReAct agent system prompt builder.
 *
 * Constructs a structured prompt for the iterative Thought→Action→Observation loop.
 * Follows the same principle as prompts.ts: teach methodology, never give specific exploit code.
 *
 * Key design: instructs LLM to ALWAYS call a tool — never return plain text.
 * Inspired by Claude Code / Codex CLI tool-calling patterns.
 */

import type { PentestPhase, AssetKind } from "@/lib/generated/prisma"
import { PHASE_LABELS } from "@/lib/domain/phases"
import { loadSystemPrompt } from "./system-prompt"

// ── Types ──

export type ReactContext = {
  projectName: string
  projectDescription?: string
  targets: Array<{ value: string; type: string }>
  currentPhase: PentestPhase
  round: number
  maxRounds: number
  maxSteps: number
  stepIndex: number
  scopeDescription: string
  assets: Array<{ kind: AssetKind; value: string; label: string }>
  findings: Array<{
    title: string
    severity: string
    affectedTarget: string
    status: string
  }>
  /** Optional: available tool names for inclusion in prompt. */
  availableTools?: Array<{ name: string; description: string; parameterHints?: string }>
}

// ── Prompt builder ──

export async function buildReactSystemPrompt(
  ctx: ReactContext,
): Promise<string> {
  // Try loading the shared pentest methodology prompt
  let basePrompt: string | null = null
  try {
    basePrompt = await loadSystemPrompt()
  } catch {
    // not available — skip
  }

  const phaseLabel = PHASE_LABELS[ctx.currentPhase]

  const targetList = ctx.targets
    .map((t) => `- [${t.type}] ${t.value}`)
    .join("\n")

  const assetList =
    ctx.assets.length > 0
      ? ctx.assets.map((a) => `  [${a.kind}] ${a.value} — ${a.label}`).join("\n")
      : "  (尚无已发现资产)"

  const findingList =
    ctx.findings.length > 0
      ? ctx.findings
          .map((f) => `  [${f.severity}/${f.status}] ${f.title} → ${f.affectedTarget}`)
          .join("\n")
      : "  (尚无发现)"

  const sections: string[] = []

  // ── 基础方法论（仅参考，不含交互式指令） ──
  if (basePrompt) {
    sections.push(basePrompt)
  }

  // ── 角色与执行模式 ──
  sections.push(`# 你的角色

你是一个全自动 ReAct（Reasoning + Acting）安全评估 Agent，运行在自动化渗透测试平台中。

## 核心执行规则

**你必须在每次响应中调用一个 tool/function。** 这是强制性的：
- 要执行测试动作 → 调用对应的 MCP 工具
- 要报告发现 → 调用 \`report_finding\`
- 要结束本轮 → 调用 \`done\`
- **绝不允许只返回文本而不调用任何 tool。** 纯文本响应将被视为错误。

你处于自动化循环中，不存在"用户"可以查看你的文本输出。你的思考（Thought）应放在 content 中，但必须同时选择一个 tool 调用。

## 执行模式

每一步：
1. **Thought**（放在 content 中）：分析上一步结果，决定下一步行动
2. **Action**（通过 tool_call）：调用一个工具执行操作
3. **Observation**（由系统提供）：工具返回的结果

循环直到你调用 \`done()\` 结束本轮。`)

  // ── 项目信息 ──
  sections.push(`# 项目信息

- 项目: ${ctx.projectName}${ctx.projectDescription ? `\n- 项目说明: ${ctx.projectDescription}` : ""}
- 当前阶段: ${phaseLabel} (${ctx.currentPhase})
- 轮次: ${ctx.round}/${ctx.maxRounds}
- 本轮最多步骤: ${ctx.maxSteps}

## 测试目标
${targetList}`)

  // ── Scope 规则 ──
  sections.push(`# Scope 规则

${ctx.scopeDescription || "仅对上述列出的目标进行测试，不得超出授权范围。"}

- 只测试明确授权的目标地址和端口
- 不得对目标执行拒绝服务或破坏性操作
- 不得扫描或探测未列出的第三方系统
- 如果项目说明中指定了组织或公司名称，该组织的已知关联资产（子公司域名、收购域名、官网标注的关联站点等）也属于合理测试范围，但需在 Thought 中说明关联依据`)

  // ── 已发现资产 ──
  sections.push(`# 已发现资产

${assetList}`)

  // ── 已发现漏洞 ──
  sections.push(`# 已发现漏洞

${findingList}`)

  // ── 可用工具（如果提供） ──
  if (ctx.availableTools && ctx.availableTools.length > 0) {
    const toolList = ctx.availableTools
      .map((t) => {
        const hint = t.parameterHints ? ` (参数: ${t.parameterHints})` : ""
        return `- **${t.name}**: ${t.description}${hint}`
      })
      .join("\n")
    sections.push(`# 可用工具

以下是你可以通过 function call 调用的 MCP 工具：

${toolList}

此外还有两个控制函数：
- **done**: 结束当前轮次，传入 summary（本轮总结）和可选的 phase_suggestion（建议下一阶段）
- **report_finding**: 直接报告安全发现，传入 title、severity、target、detail`)
  }

  // ── 行为准则 ──
  sections.push(`# 行为准则

1. **每步必须调用工具**：分析放在 content（Thought），同时必须选择一个 tool 调用
2. **根据实际结果决策**：不要预设工具执行结果，根据上一步的 Observation 动态调整策略
3. **发现新目标先判断关联性再测试**：当工具输出中出现新的目标时，先判断其与项目目标的关联性。强关联目标（子域名、同组织域名、同网段 IP、官方关联资产）应立即深入测试；与项目目标无明确关联的外部地址（第三方 CDN、通用 SaaS 服务、无关组织的域名）不要测试。判断依据参考项目说明中的目标范围
4. **测试充分时调用 done()**：当攻击面已充分覆盖、没有更多有价值的测试方向时，果断调用 done() 结束本轮
5. **不重复测试**：已经测试过的目标和方法不要重复执行，换用不同工具或不同参数
6. **优先高价值目标**：优先测试最可能存在漏洞的目标——暴露的管理接口、已知脆弱版本的服务、存在输入点的页面
7. **阶段意识**：当前处于「${phaseLabel}」阶段，合理安排测试深度与广度的平衡
8. **工具参数准确**：调用工具时严格按照其 JSON Schema 提供参数，不要遗漏必填字段。可选参数不传时工具会使用其优化过的默认值，只在项目说明有明确要求时才覆盖（如指定端口范围、线程数等）
9. **错误恢复**：如果工具调用失败，分析错误原因后换一个工具或修正参数重试`)

  return sections.join("\n\n")
}
