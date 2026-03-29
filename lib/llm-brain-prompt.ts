import type { McpToolRecord, ProjectRecord } from "@/lib/prototype-types"

type ProjectBrainPromptInput = {
  assetCount: number
  availableTools: Pick<McpToolRecord, "boundary" | "capability" | "requiresApproval" | "riskLevel" | "toolName">[]
  controlCommand: "replan" | "resume" | "start"
  currentStage: string
  description: string
  evidenceCount: number
  findingCount: number
  note?: string
  pendingApprovals: number
  projectName: string
  recentContext: string[]
  targetInput: string
  targets: string[]
}

type LocalLabBrainPromptInput = {
  approvalScenario: "include-high-risk" | "none"
  availableTools: Pick<McpToolRecord, "boundary" | "capability" | "requiresApproval" | "riskLevel" | "toolName">[]
  baseUrl: string
  projectName: string
  projectStage: string
}

type ProjectReviewerPromptInput = {
  assetCount: number
  description: string
  evidenceCount: number
  findingCount: number
  latestReportSummary: string
  projectName: string
  recentContext: string[]
  stage: string
  targets: string[]
}

function formatToolLine(tool: ProjectBrainPromptInput["availableTools"][number]) {
  return `- capability=${tool.capability}; tool=${tool.toolName}; risk=${tool.riskLevel}; boundary=${tool.boundary}; approval=${tool.requiresApproval ? "required" : "optional"}`
}

function formatTargets(project: Pick<ProjectRecord, "targetInput" | "targets">) {
  if (project.targets.length > 0) {
    return project.targets.map((target) => `- ${target}`).join("\n")
  }

  return project.targetInput.trim() || "- (empty)"
}

export const ORCHESTRATOR_BRAIN_SYSTEM_PROMPT = [
  "你是授权渗透测试平台里的 LLM 编排大脑。",
  "你的职责是把研究员给出的项目目标，拆成安全、可执行、可回流结果的 MCP 动作计划。",
  "LLM 只负责理解目标、规划顺序、判断下一步和停止条件；绝不伪造执行结果，也不直接代替 MCP 与目标交互。",
  "必须遵守以下规则：",
  "1. 只允许使用当前已注册工具暴露出来的 capability；不要发明不存在的 capability 或 tool。",
  "2. 优先低风险、被动、可枚举、可留痕的动作；先目标解析，再资产发现，再入口识别，再决定是否需要验证。",
  "3. 高风险、需要认证绕过、写入、利用、爆破、状态改变类动作，只能在确有必要时给出，并明确标记 riskLevel=高。",
  "4. 如果已有结果已经足够支撑下一步判断，就不要重复安排同类动作。",
  "5. target 必须是一个明确、可执行的单一目标值；一条 item 只做一个动作。",
  "6. requestedAction 要具体到 MCP 能做的事情，不能写空泛表述。",
  "7. rationale 要解释为什么是现在做，而不是泛泛而谈。",
  "8. 只返回 JSON 对象，包含 summary 和 items。items 中每条都必须包含 capability、requestedAction、target、riskLevel、rationale、toolName。toolName 必须从可用工具列表中选取，对应你想调用的具体工具。",
].join("\n")

export const REVIEWER_BRAIN_SYSTEM_PROMPT = [
  "你是授权渗透测试平台里的结果审阅模型。",
  "你只能基于已有结果、证据和上下文，返回下一步建议或复核结论。",
  "只返回 JSON 对象，包含 summary 和 items。items 中每条都必须包含 capability、requestedAction、target、riskLevel、rationale、toolName。toolName 必须从可用工具列表中选取。",
].join("\n")

export function buildProjectBrainPrompt(input: ProjectBrainPromptInput) {
  const commandLine =
    input.controlCommand === "start"
      ? "研究员刚刚手动开始项目。请输出第一轮最小可执行计划。"
      : input.controlCommand === "resume"
        ? "研究员刚刚恢复项目。请基于已有结果输出下一轮续跑计划，避免重复已完成动作。"
        : "请基于当前状态重新整理最合理的下一轮计划。"
  const recentContext =
    input.recentContext.length > 0 ? input.recentContext.map((line) => `- ${line}`).join("\n") : "- 当前还没有更多上下文。"

  return [
    commandLine,
    `项目名称：${input.projectName}`,
    `当前阶段：${input.currentStage}`,
    `项目说明：${input.description || "无"}`,
    `目标原文：\n${input.targetInput || "(empty)"}`,
    `标准化目标列表：\n${formatTargets({ targetInput: input.targetInput, targets: input.targets })}`,
    `当前结果摘要：资产数量=${input.assetCount}; 证据数量=${input.evidenceCount}; 漏洞/发现数量=${input.findingCount}; 待审批=${input.pendingApprovals}`,
    `最近上下文：\n${recentContext}`,
    input.note ? `研究员备注：${input.note}` : "研究员备注：无",
    "当前可用 MCP 能力与工具：",
    ...input.availableTools.map(formatToolLine),
    "输出要求：",
    "- 默认给出 3 到 6 条 item。",
    "- 可以包含后续需要审批的动作，但只有在低风险结果已经支撑它时才允许出现高风险动作。",
    "- 对同一个 target，先安排整理/发现，再安排验证；不要直接跳到高风险动作。",
    "- 范围约束：只能围绕项目输入目标本身、域名目标的子域、以及原始 IP/CIDR 展开；不要因为结果里出现了新域名或新网段就自动越界。",
    "- 如果目标是 URL 且 host 为 IP 或 localhost，不要安排 DNS / 子域类动作。",
  ].join("\n")
}

export function buildLocalLabBrainPrompt(input: LocalLabBrainPromptInput) {
  return [
    input.approvalScenario === "include-high-risk"
      ? "请为本地靶场输出一个包含低风险发现和一条高风险审批动作的最小闭环计划。"
      : "请为本地靶场输出一个只包含低风险动作的最小闭环计划。",
    `项目名称：${input.projectName}`,
    `项目阶段：${input.projectStage}`,
    `本地靶场 URL：${input.baseUrl}`,
    "当前可用 MCP 能力与工具：",
    ...input.availableTools.map(formatToolLine),
    "输出要求：",
    "- target 必须直接填写可访问 URL。",
    "- 优先目标解析、Web 入口识别、结构发现；高风险验证仅在 approvalScenario=include-high-risk 时出现。",
  ].join("\n")
}

export function buildProjectReviewerPrompt(input: ProjectReviewerPromptInput) {
  const recentContext =
    input.recentContext.length > 0 ? input.recentContext.map((line) => `- ${line}`).join("\n") : "- 当前没有更多运行上下文。"
  const targets = input.targets.length > 0 ? input.targets.map((target) => `- ${target}`).join("\n") : "- (empty)"

  return [
    "请基于当前项目已沉淀的真实资产、证据、漏洞/发现和最近活动，生成项目最终结论。",
    "不要发明新的资产、漏洞或执行结果，只能总结已有事实。",
    "summary 必须是一段完整的中文最终结论。",
    "items 只保留 1 到 3 条后续建议，不要再输出新的 MCP 计划。",
    `项目名称：${input.projectName}`,
    `当前阶段：${input.stage}`,
    `项目说明：${input.description || "无"}`,
    `目标列表：\n${targets}`,
    `当前计数：资产=${input.assetCount}; 证据=${input.evidenceCount}; 漏洞/发现=${input.findingCount}`,
    `最近报告摘要：${input.latestReportSummary || "尚未导出报告摘要。"}`,
    `最近上下文：\n${recentContext}`,
  ].join("\n")
}
