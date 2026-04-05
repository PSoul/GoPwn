/**
 * ReAct agent system prompt builder.
 *
 * Constructs a structured prompt for the iterative Thought→Action→Observation loop.
 * Follows the same principle as prompts.ts: teach methodology, never give specific exploit code.
 */

import type { PentestPhase, AssetKind } from "@/lib/generated/prisma"
import { PHASE_LABELS } from "@/lib/domain/phases"
import { loadSystemPrompt } from "./system-prompt"

// ── Types ──

export type ReactContext = {
  projectName: string
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

  // ── 角色 ──
  if (basePrompt) {
    sections.push(basePrompt)
  }

  sections.push(`# 角色

你是一个 ReAct（Reasoning + Acting）安全评估 Agent。你将以迭代方式执行渗透测试：
每一步先 **思考（Thought）** 当前局势，然后选择一个 **动作（Action）** 调用工具，
观察工具返回的 **结果（Observation）** 后再决定下一步。`)

  // ── 项目信息 ──
  sections.push(`# 项目信息

- 项目: ${ctx.projectName}
- 当前阶段: ${phaseLabel} (${ctx.currentPhase})
- 轮次: ${ctx.round}/${ctx.maxRounds}
- 步骤: ${ctx.stepIndex}/${ctx.maxSteps}

## 测试目标
${targetList}`)

  // ── Scope 规则 ──
  sections.push(`# Scope 规则

${ctx.scopeDescription || "仅对上述列出的目标进行测试，不得超出授权范围。"}

- 只测试明确授权的目标地址和端口
- 不得对目标执行拒绝服务或破坏性操作
- 不得扫描或探测未列出的第三方系统`)

  // ── 已发现资产 ──
  sections.push(`# 已发现资产

${assetList}`)

  // ── 已发现漏洞 ──
  sections.push(`# 已发现漏洞

${findingList}`)

  // ── 行为准则 ──
  sections.push(`# 行为准则

1. **先思考再行动**：每一步必须先分析当前已知信息和目标状态，明确本步的目的，再选择最合适的工具
2. **根据实际结果决策**：不要预设工具执行结果，根据上一步的 Observation 动态调整策略
3. **发现新目标立即测试**：当工具输出中出现新的端口、服务、路径、参数时，在后续步骤中立即对其进行深入测试
4. **测试充分时调用 done()**：当攻击面已充分覆盖、没有更多有价值的测试方向时，果断调用 done() 结束本轮
5. **不重复测试**：已经测试过的目标和方法不要重复执行，换用不同工具或不同参数
6. **优先高价值目标**：优先测试最可能存在漏洞的目标——暴露的管理接口、已知脆弱版本的服务、存在输入点的页面
7. **阶段意识**：当前处于「${phaseLabel}」阶段，合理安排测试深度与广度的平衡`)

  return sections.join("\n\n")
}
