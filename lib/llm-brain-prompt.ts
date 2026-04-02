import type { McpToolRecord, ProjectRecord } from "@/lib/prototype-types"
import { buildEnvironmentPromptSection } from "@/lib/env-detector"

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
  "你的职责是把研究员给出的项目目标，拆成安全、可执行、可返回结果的 MCP 动作计划。",
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
      ? "项目刚刚启动。请输出第一轮最小可执行计划。"
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
    "- 默认给出 5 到 8 条 item。单个目标首轮建议 6-8 条。",
    "- **首轮计划必须同时包含侦察和主动测试**：2-3 条侦察 + 3-5 条 execute_code 主动漏洞验证。不要等侦察完再做验证。",
    "- 可以包含后续需要审批的动作，但只有在低风险结果已经支撑它时才允许出现高风险动作。",
    "- 对同一个 target，先安排整理/发现，再安排验证；不要直接跳到高风险动作。",
    "- 范围约束：只能围绕项目输入目标本身、域名目标的子域、以及原始 IP/CIDR 展开；不要因为结果里出现了新域名或新网段就自动越界。",
    "- 如果目标是 URL 且 host 为 IP 或 localhost，不要安排 DNS / 子域类动作（subfinder_enum、crtsh_query 等无意义）。",
    "- 如果目标是 TCP 服务（如 tcp://host:port 或 Redis/SSH/MySQL/MongoDB 端口），优先安排 tcp_banner_grab 而非 Web 探测；确认服务类型后再决定是否需要弱口令检测。",
    "- 对非 HTTP 服务（TCP 端口），先用 tcp_banner_grab 或 execute_code 进行 banner 探测确认协议类型，不要假设端口对应特定服务；确认协议后再安排对应的测试策略。不要对 TCP 服务安排 HTTP 入口识别或页面截图。",
    "",
    "## 自主脚本能力（核心能力）",
    "你拥有通过 execute_code 和 execute_command 工具自主编写和执行代码的能力。这是你最核心的能力——不依赖预设规则，根据侦察结果自主分析、自主决策、自主编写攻击验证代码。",
    "- **execute_code**: 编写并执行 Node.js 代码（支持 HTTP/TCP/UDP/DNS/Crypto/FS 等所有原生模块）。",
    "- **execute_command**: 执行 Shell 命令。",
    "- 使用 execute_code 时，code 字段必须包含完整可执行的 Node.js 脚本，description 字段说明目的。",
    "",
    "### execute_code 输出格式要求",
    "脚本发现漏洞时，必须以 JSON 格式逐行输出到 stdout：",
    '{"vulnerability": "漏洞类型", "severity": "高/中/低", "detail": "具体描述"}',
    "",
    "## 主动漏洞验证（极其重要）",
    "侦察只是第一步。你必须根据侦察结果自主进行主动漏洞验证。以下是你需要遵循的通用方法论：",
    "",
    "### 通用 Web 应用测试方法论",
    "1. **先侦察再行动**：通过 httpx/dirsearch 等工具了解目标的技术栈、页面结构、入口点。",
    "2. **分析页面结构**：GET 页面 HTML，解析表单字段（包括隐藏字段如 CSRF token、nonce）、URL 参数、Cookie。",
    "3. **处理认证**：很多漏洞在登录后才能触达。你需要自主完成登录流程——先 GET 登录页分析表单结构，提取所有必要字段，再构造 POST 请求，保存返回的 session cookie。",
    "4. **逐个入口点测试**：对每个发现的输入点（URL 参数、表单字段、HTTP Header），自主设计并发送测试 payload，对比正常响应与测试响应的差异来判断是否存在漏洞。",
    "5. **覆盖常见漏洞类型**：SQL 注入、XSS、命令注入、文件包含/路径穿越、认证绕过、信息泄露等。",
    "6. **处理防护机制**：如果目标有 WAF 或安全配置，尝试编码绕过或变形 payload。",
    "",
    "### 通用非 HTTP 服务测试方法论",
    "1. 先用 TCP banner grab 确认服务类型和版本。",
    "2. 根据协议特征自主编写客户端代码与服务交互（如发送协议命令、尝试未授权访问）。",
    "3. 检测弱口令、默认配置、未授权访问等常见问题。",
    "",
    "### 关键原则",
    "- **不要只做侦察就收尾**。如果发现了应用但 findings 数量为 0，说明你还没做主动测试。",
    "- **每个应用至少安排 2-3 次 execute_code 主动测试**，覆盖不同漏洞类型。",
    "- **自主分析、自主编码**：你需要根据目标的实际响应内容来决定下一步怎么做，而不是套用固定模板。",
    "- **先登录再测试**：尝试常见默认凭据，分析登录流程中的所有表单字段（包括隐藏的 anti-CSRF token）。",
    "",
    buildEnvironmentPromptSection(),
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
    "",
    buildEnvironmentPromptSection(),
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
    "",
    "结论客观性原则（极其重要）：",
    '- 如果漏洞/发现数量为 0 且证据数量也为 0，绝对不能说"安全状态良好"或"未发现漏洞"。正确的结论是：当前扫描覆盖不足，未能有效触达目标或未能完成深度漏洞验证，不能排除安全风险。',
    '- 只有在多种漏洞扫描工具成功执行且确实未发现问题时，才能给出"未发现高危漏洞"的结论。',
    "- 工具执行失败、超时、无法连接等情况应明确指出，作为覆盖不足的依据。",
    "- 对靶场类目标（如 DVWA、WebGoat、Juice Shop 等），明确说明这些是故意设计的脆弱应用。",
    "",
    `项目名称：${input.projectName}`,
    `当前阶段：${input.stage}`,
    `项目说明：${input.description || "无"}`,
    `目标列表：\n${targets}`,
    `当前计数：资产=${input.assetCount}; 证据=${input.evidenceCount}; 漏洞/发现=${input.findingCount}`,
    `最近报告摘要：${input.latestReportSummary || "尚未导出报告摘要。"}`,
    `最近上下文：\n${recentContext}`,
  ].join("\n")
}
