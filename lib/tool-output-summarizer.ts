/**
 * tool-output-summarizer.ts — 工具输出结构化摘要
 *
 * 在 MCP 工具原始输出和 LLM context 之间的压缩层。
 * 每个工具类型有专属摘要规则，把几千行输出压缩为关键发现。
 * 原始输出仍完整存储在证据库中，只有传给 LLM 的部分被压缩。
 *
 * 压缩阈值由 agent-config.ts 中的参数控制：
 * - toolOutputSummarizeThreshold: 超过此字符数使用摘要
 * - toolOutputMaxChars: 超过此字符数截断
 */
import { getAgentConfig } from "@/lib/agent-config"

/** 单条工具执行摘要 */
export interface ToolOutputSummary {
  /** 工具名 */
  toolName: string
  /** 目标 */
  target: string
  /** 执行状态 */
  status: "成功" | "失败" | "超时" | "待审批"
  /** 结构化关键发现（给 LLM 看） */
  keyFindings: string[]
  /** 原始输出字符数 */
  rawOutputLength: number
  /** 压缩比 */
  compressionRatio: number
}

/**
 * 判断是否应该对输出使用摘要（基于 agent-config 阈值）。
 * 低于阈值的输出直接传原文，超过阈值的使用结构化摘要。
 */
export function shouldSummarize(rawOutput: string): boolean {
  const config = getAgentConfig()
  return rawOutput.length > config.context.toolOutputSummarizeThreshold
}

/**
 * 截断过长的原始输出（基于 agent-config 最大字符数）
 */
export function truncateOutput(rawOutput: string): string {
  const config = getAgentConfig()
  if (rawOutput.length <= config.context.toolOutputMaxChars) return rawOutput
  return rawOutput.slice(0, config.context.toolOutputMaxChars) + `\n...[截断: 原始 ${rawOutput.length} 字符, 保留 ${config.context.toolOutputMaxChars}]`
}

/** 从 MCP run 的原始输出中提取摘要 */
export function summarizeToolOutput(
  toolName: string,
  target: string,
  status: string,
  rawOutput: string,
): ToolOutputSummary {
  const statusLabel = mapStatus(status)
  // 先截断过长输出，再提取摘要
  const truncated = truncateOutput(rawOutput)
  const findings = extractKeyFindings(toolName, truncated)
  const summaryText = findings.join("; ")

  return {
    toolName,
    target,
    status: statusLabel,
    keyFindings: findings,
    rawOutputLength: rawOutput.length,
    compressionRatio: summaryText.length > 0 ? rawOutput.length / summaryText.length : 1,
  }
}

function mapStatus(status: string): ToolOutputSummary["status"] {
  switch (status) {
    case "已执行": return "成功"
    case "已阻塞": return "失败"
    case "待审批": return "待审批"
    default: return "失败"
  }
}

/** 按工具类型提取关键发现 */
function extractKeyFindings(toolName: string, rawOutput: string): string[] {
  if (!rawOutput || rawOutput.trim().length === 0) return ["无输出"]

  // 工具名到提取器的映射
  const extractors: Record<string, (output: string) => string[]> = {
    httpx_probe: extractHttpxFindings,
    httpx_tech_detect: extractHttpxFindings,
    wafw00f_detect: extractWafw00fFindings,
    wafw00f_fingerprint: extractWafw00fFindings,
    fscan_port_scan: extractFscanFindings,
    fscan_host_discovery: extractFscanFindings,
    fscan_comprehensive_scan: extractFscanFindings,
    afrog_poc_scan: extractAfrogFindings,
    dirsearch_scan: extractDirsearchFindings,
    subfinder_enumerate: extractSubfinderFindings,
    curl_http_request: extractCurlFindings,
    netcat_tcp_connect: extractNetcatFindings,
    tcp_banner_grab: extractNetcatFindings,
    whois_domain: extractWhoisFindings,
    whois_ip: extractWhoisFindings,
    fofa_search: extractFofaFindings,
    execute_code: extractScriptFindings,
    execute_command: extractScriptFindings,
  }

  const extractor = extractors[toolName]
  if (extractor) {
    const findings = extractor(rawOutput)
    return findings.length > 0 ? findings : extractGenericFindings(rawOutput)
  }

  return extractGenericFindings(rawOutput)
}

/** httpx: 提取 HTTP 状态码、标题、技术栈 */
function extractHttpxFindings(output: string): string[] {
  const findings: string[] = []
  const lines = output.split("\n").filter(Boolean)

  for (const line of lines.slice(0, 20)) {
    // httpx JSON output format
    try {
      const obj = JSON.parse(line)
      if (obj.url) {
        const parts = [obj.url]
        if (obj.status_code) parts.push(`HTTP ${obj.status_code}`)
        if (obj.title) parts.push(`"${obj.title}"`)
        if (obj.tech?.length) parts.push(`技术: ${obj.tech.join(",")}`)
        if (obj.webserver) parts.push(`Server: ${obj.webserver}`)
        findings.push(parts.join(" | "))
      }
    } catch {
      // Plain text output
      if (line.includes("http")) {
        findings.push(line.trim().slice(0, 200))
      }
    }
  }

  return findings.slice(0, 10)
}

/** wafw00f: WAF 检测结果 */
function extractWafw00fFindings(output: string): string[] {
  const findings: string[] = []

  if (/no waf/i.test(output)) {
    findings.push("未检测到 WAF")
  }

  const wafMatch = output.match(/is behind (\S+)/i)
  if (wafMatch) {
    findings.push(`检测到 WAF: ${wafMatch[1]}`)
  }

  const wafNameMatch = output.match(/WAF identified:\s*(.+)/i)
  if (wafNameMatch) {
    findings.push(`WAF: ${wafNameMatch[1].trim()}`)
  }

  return findings
}

/** fscan: 端口扫描、主机发现 */
function extractFscanFindings(output: string): string[] {
  const findings: string[] = []
  const openPorts: string[] = []
  const services: string[] = []
  const vulns: string[] = []

  for (const line of output.split("\n")) {
    // Open port
    const portMatch = line.match(/(\d+\.\d+\.\d+\.\d+):(\d+)\s+open/)
    if (portMatch) {
      openPorts.push(`${portMatch[1]}:${portMatch[2]}`)
    }
    // Service banner
    if (line.includes("Banner:") || line.includes("banner:")) {
      services.push(line.trim().slice(0, 150))
    }
    // Vulnerability
    if (/\[(\+|!|vuln|poc)\]/i.test(line)) {
      vulns.push(line.trim().slice(0, 150))
    }
  }

  if (openPorts.length > 0) {
    findings.push(`开放端口(${openPorts.length}): ${openPorts.slice(0, 15).join(", ")}${openPorts.length > 15 ? "..." : ""}`)
  }
  if (services.length > 0) {
    findings.push(...services.slice(0, 5))
  }
  if (vulns.length > 0) {
    findings.push(...vulns.slice(0, 5))
  }

  return findings
}

/** afrog: POC 漏洞扫描 */
function extractAfrogFindings(output: string): string[] {
  const findings: string[] = []

  for (const line of output.split("\n")) {
    // afrog output format: [severity] [poc-id] url
    const vulnMatch = line.match(/\[(critical|high|medium|low|info)\]\s*\[([^\]]+)\]\s*(.+)/i)
    if (vulnMatch) {
      findings.push(`[${vulnMatch[1].toUpperCase()}] ${vulnMatch[2]} → ${vulnMatch[3].trim().slice(0, 100)}`)
    }
  }

  return findings.length > 0 ? findings.slice(0, 10) : ["未发现 POC 匹配"]
}

/** dirsearch: 目录爆破 */
function extractDirsearchFindings(output: string): string[] {
  const findings: string[] = []
  const statuses: Record<string, string[]> = {}

  for (const line of output.split("\n")) {
    const match = line.match(/(\d{3})\s+[\d\w]+\s+[\d\w]+\s+(.+)/)
    if (match) {
      const code = match[1]
      const path = match[2].trim()
      if (!statuses[code]) statuses[code] = []
      statuses[code].push(path)
    }
  }

  for (const [code, paths] of Object.entries(statuses)) {
    if (code === "404") continue // skip not found
    findings.push(`HTTP ${code}: ${paths.slice(0, 5).join(", ")}${paths.length > 5 ? ` (+${paths.length - 5})` : ""}`)
  }

  return findings.length > 0 ? findings.slice(0, 8) : ["未发现有效路径"]
}

/** subfinder: 子域名枚举 */
function extractSubfinderFindings(output: string): string[] {
  const domains = output.split("\n").map(l => l.trim()).filter(l => l && l.includes("."))
  if (domains.length === 0) return ["未发现子域名"]

  const display = domains.slice(0, 15).join(", ")
  return [`发现子域名(${domains.length}): ${display}${domains.length > 15 ? "..." : ""}`]
}

/** curl: HTTP 请求结果 */
function extractCurlFindings(output: string): string[] {
  const findings: string[] = []

  // HTTP status
  const statusMatch = output.match(/HTTP\/[\d.]+\s+(\d{3})/i)
  if (statusMatch) {
    findings.push(`HTTP ${statusMatch[1]}`)
  }

  // Server header
  const serverMatch = output.match(/[Ss]erver:\s*(.+)/i)
  if (serverMatch) {
    findings.push(`Server: ${serverMatch[1].trim()}`)
  }

  // Title
  const titleMatch = output.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) {
    findings.push(`标题: "${titleMatch[1].trim()}"`)
  }

  // Content length indicator
  if (output.length > 0) {
    findings.push(`响应大小: ${output.length} 字节`)
  }

  return findings
}

/** netcat/banner: TCP 连接和 banner */
function extractNetcatFindings(output: string): string[] {
  const findings: string[] = []

  if (output.includes("Connected") || output.includes("open")) {
    findings.push("TCP 连接成功")
  }

  // Extract service banner (first non-empty line that looks like a banner)
  const bannerLines = output.split("\n").filter(l => l.trim() && !l.startsWith("["))
  if (bannerLines.length > 0) {
    findings.push(`Banner: ${bannerLines[0].trim().slice(0, 200)}`)
  }

  return findings
}

/** whois: 域名/IP 所有权 */
function extractWhoisFindings(output: string): string[] {
  const findings: string[] = []

  const orgMatch = output.match(/[Oo]rg(?:anization)?.*?:\s*(.+)/)
  if (orgMatch) findings.push(`组织: ${orgMatch[1].trim()}`)

  const registrarMatch = output.match(/[Rr]egistrar:\s*(.+)/)
  if (registrarMatch) findings.push(`注册商: ${registrarMatch[1].trim()}`)

  const countryMatch = output.match(/[Cc]ountry:\s*(.+)/)
  if (countryMatch) findings.push(`国家: ${countryMatch[1].trim()}`)

  const netMatch = output.match(/[Nn]et[Rr]ange:\s*(.+)/)
  if (netMatch) findings.push(`网段: ${netMatch[1].trim()}`)

  return findings
}

/** FOFA: 资产搜索 */
function extractFofaFindings(output: string): string[] {
  const findings: string[] = []

  try {
    const data = JSON.parse(output)
    if (data.size !== undefined) findings.push(`匹配资产数: ${data.size}`)
    if (Array.isArray(data.results)) {
      findings.push(`结果(${data.results.length}): ${data.results.slice(0, 5).map((r: string[]) => r[0]).join(", ")}`)
    }
  } catch {
    const lines = output.split("\n").filter(Boolean)
    if (lines.length > 0) findings.push(`结果: ${lines.slice(0, 5).join(", ")}`)
  }

  return findings
}

/** execute_code / execute_command: 自定义脚本输出 */
function extractScriptFindings(output: string): string[] {
  const findings: string[] = []

  // Try to parse JSON output (common for LLM scripts)
  try {
    const data = JSON.parse(output)
    if (data.exitCode !== undefined) {
      findings.push(`退出码: ${data.exitCode}`)
    }
    const stdout = data.stdout || ""
    // Try to parse stdout as JSON (nested JSON from scripts)
    for (const line of stdout.split("\n").filter(Boolean)) {
      try {
        const inner = JSON.parse(line)
        const summary = Object.entries(inner)
          .filter(([, v]) => typeof v !== "object")
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")
        if (summary) findings.push(summary.slice(0, 200))
      } catch {
        if (line.trim()) findings.push(line.trim().slice(0, 200))
      }
    }
  } catch {
    // Plain text output - take first few meaningful lines
    const lines = output.split("\n").filter(l => l.trim()).slice(0, 5)
    findings.push(...lines.map(l => l.trim().slice(0, 200)))
  }

  return findings.slice(0, 8)
}

/** 通用提取器：不认识的工具用这个 */
function extractGenericFindings(output: string): string[] {
  const findings: string[] = []

  // Try JSON first
  try {
    const data = JSON.parse(output)
    const keys = Object.keys(data).slice(0, 5)
    findings.push(`JSON 输出: {${keys.join(", ")}} (${output.length} 字节)`)
    return findings
  } catch {
    // Not JSON
  }

  // Count meaningful lines
  const lines = output.split("\n").filter(l => l.trim())
  findings.push(`文本输出: ${lines.length} 行, ${output.length} 字节`)

  // Extract first 3 non-empty lines as preview
  for (const line of lines.slice(0, 3)) {
    findings.push(line.trim().slice(0, 150))
  }

  return findings
}

