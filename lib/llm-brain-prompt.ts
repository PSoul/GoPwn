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
    "- 默认给出 3 到 6 条 item。单个目标首轮建议 4-5 条即可，不要贪多。",
    "- 可以包含后续需要审批的动作，但只有在低风险结果已经支撑它时才允许出现高风险动作。",
    "- 对同一个 target，先安排整理/发现，再安排验证；不要直接跳到高风险动作。",
    "- 范围约束：只能围绕项目输入目标本身、域名目标的子域、以及原始 IP/CIDR 展开；不要因为结果里出现了新域名或新网段就自动越界。",
    "- 如果目标是 URL 且 host 为 IP 或 localhost，不要安排 DNS / 子域类动作（subfinder_enum、crtsh_query 等无意义）。",
    "- 如果目标是 TCP 服务（如 tcp://host:port 或 Redis/SSH/MySQL/MongoDB 端口），优先安排 tcp_banner_grab 而非 Web 探测；确认服务类型后再决定是否需要弱口令检测。",
    "- 对非 HTTP 服务（Redis 6379、SSH 22/2222、MySQL 3306/13307、MongoDB 27017），不要安排 HTTP 入口识别或页面截图。",
    "",
    "## 自主脚本能力（重要）",
    "当现有 MCP 工具无法覆盖某个验证场景时，你可以使用 execute_code 工具自主编写 Node.js 脚本进行攻击和验证：",
    "- **execute_code**: 编写并执行 Node.js 代码。Node.js 原生支持 HTTP/TCP/UDP/DNS/Crypto/FS，你可以用它完成任何网络探测、协议交互、漏洞验证。",
    "- **execute_command**: 执行 Shell 命令，调用系统工具（curl/python/dig 等）。",
    "- 典型场景：Redis 未授权访问检测（发送 INFO 命令）、SSH 弱口令尝试、MySQL 协议握手、MongoDB 未授权查询、自定义 HTTP payload 发送、SQL 注入验证等。",
    "- 使用 execute_code 时，code 字段必须包含完整可执行的 Node.js 代码，description 字段说明目的。",
    "- 脚本执行结果会被自动沉淀为证据和发现。",
    "- 这是你作为 LLM 大脑最核心的能力：不依赖写死规则，自主决策、自主编写攻击代码。",
    "",
    "## 主动漏洞验证阶段（极其重要）",
    "侦察（httpx/wafw00f/dirsearch）只是第一步。发现 Web 应用后，你**必须**用 execute_code 主动测试常见漏洞：",
    "",
    "### 必测漏洞类型",
    "1. **SQL 注入** — 向表单/URL 参数发送 `' OR '1'='1` 等 payload，对比正常响应与注入响应的差异",
    "2. **XSS（跨站脚本）** — 向输入框发送 `<script>alert(1)</script>`，检查响应中是否原样反射",
    "3. **命令注入** — 向输入框发送 `; id` 或 `| whoami`，检查响应中是否包含系统命令输出（uid=, root 等）",
    "4. **文件包含** — 尝试 `../../etc/passwd` 或 `....//....//etc/passwd`",
    "5. **认证绕过** — 测试默认凭据（admin/password, admin/admin123 等）",
    "",
    "### execute_code 输出格式要求",
    "脚本必须输出如下 JSON 格式，每发现一个漏洞打印一行：",
    "```",
    '{"vulnerability": "SQL注入", "severity": "高", "detail": "参数id存在SQL注入，payload触发了不同响应"}',
    "```",
    "",
    "### execute_code 中的 code 字段",
    "在 plan item 中，当 toolName 为 execute_code 时，你**必须**提供 `code` 字段，包含完整的 Node.js 脚本。",
    "如果你不提供 code 字段，系统只会执行一个简单的 GET 请求，无法发现任何漏洞。",
    "",
    "### SQL 注入测试代码示例",
    "```javascript",
    "const http = require('http');",
    "function post(path, body) {",
    "  return new Promise((resolve, reject) => {",
    "    const data = typeof body === 'string' ? body : new URLSearchParams(body).toString();",
    "    const req = http.request({ hostname: 'localhost', port: 8081, path, method: 'POST',",
    "      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': sessionCookie }",
    "    }, res => { let b=''; res.on('data',c=>b+=c); res.on('end',()=>resolve({status:res.statusCode,body:b})); });",
    "    req.on('error', reject); req.write(data); req.end();",
    "  });",
    "}",
    "// 先登录获取 session，再测试 SQL 注入",
    "// 正常请求 vs 注入请求对比响应长度差异",
    "```",
    "",
    "### 关键原则",
    "- **不要只做侦察就收尾**。如果发现了 Web 应用但 findings 数量为 0，说明你还没做主动测试。",
    "- **每个 Web 应用至少安排 2-3 次 execute_code 主动测试**（SQLi + XSS + 命令注入）。",
    "- **先登录再测试**：很多 Web 漏洞在认证后才能触达，先尝试默认凭据登录。",
    "- 对已知靶场（DVWA 默认 admin/password, WebGoat, Juice Shop），直接使用默认凭据。",
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

export const ANALYZER_BRAIN_SYSTEM_PROMPT = [
  "你是授权渗透测试平台的工具结果分析引擎。",
  "你的职责是分析 MCP 工具的执行输出，提取安全发现（漏洞）、资产信息和证据摘要。",
  "",
  "规则：",
  "1. 只基于实际输出内容做出判断，绝不编造不存在的发现。",
  "2. severity 使用中文：高危、中危、低危、信息。",
  "3. 资产 type 使用：domain、host、port、web_entry、service。",
  "4. 如果输出中没有有价值的安全发现，findings 返回空数组。",
  "5. 对于信息性结果（如 'No WAF Detected'、'未检测到'），不要创建 finding。",
  "6. 对于明确的漏洞证据（如默认凭据登录成功、SQL 注入成功、未授权访问），必须创建 finding。",
  "7. 端口开放本身是 info 级别，只有当服务存在漏洞时才升级 severity。",
  "8. 如果工具执行失败或返回错误，在 summary 中说明失败原因，不要创建 finding。",
  "9. 只返回 JSON 对象，不要添加任何其他文本。",
].join("\n")

export function buildToolAnalysisPrompt(input: {
  toolName: string
  target: string
  capability: string
  requestedAction: string
  rawOutput: string
}) {
  return [
    `工具名称：${input.toolName}`,
    `目标：${input.target}`,
    `能力类别：${input.capability}`,
    `请求动作：${input.requestedAction}`,
    "",
    "工具原始输出：",
    "---",
    input.rawOutput,
    "---",
    "",
    "请分析以上输出，返回如下 JSON（不要添加 markdown 代码块标记）：",
    "{",
    '  "findings": [',
    '    { "title": "漏洞标题", "severity": "高危|中危|低危|信息", "detail": "详细描述", "target": "受影响目标URL或IP:端口", "recommendation": "修复建议" }',
    "  ],",
    '  "assets": [',
    '    { "type": "domain|host|port|web_entry|service", "value": "资产值（如IP、域名、URL、IP:端口）", "detail": "补充说明（如服务类型、版本、标题等）" }',
    "  ],",
    '  "summary": "一句话总结本次工具执行结果"',
    "}",
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
