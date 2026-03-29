import { callMcpServerTool } from "@/lib/mcp-client-service"
import { getDiscoveredMcpServerConfig, getServerKeyByToolName, getToolMappingByToolName } from "@/lib/mcp-auto-discovery"
import { throwIfExecutionAborted } from "@/lib/mcp-execution-abort"
import { findStoredEnabledMcpServerByToolBinding } from "@/lib/mcp-server-repository"
import type { McpConnector, McpConnectorExecutionContext, McpConnectorResult } from "@/lib/mcp-connectors/types"
import type { McpServerRecord } from "@/lib/prototype-types"

function isStdioMcpTool(toolName: string): boolean {
  return getServerKeyByToolName(toolName) !== null
}

function buildToolArguments(toolName: string, target: string): Record<string, unknown> {
  // Map platform requestedAction/target to MCP tool-specific parameters
  const args: Record<string, unknown> = {}

  // DNS / subdomain tools
  if (toolName === "subfinder_enum" || toolName === "subfinder_verify") {
    args.target = target.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/:\d+$/, "")
    return args
  }

  // Port scanning tools -- fscan expects IP or CIDR, not a URL
  if (toolName === "fscan_host_discovery" || toolName === "fscan_port_scan") {
    try {
      const url = new URL(target)
      args.target = url.hostname
      // If the URL has a non-standard port, pass it so fscan scans that specific port
      if (url.port && toolName === "fscan_port_scan") {
        args.ports = url.port
      }
    } catch {
      args.target = target.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/:\d+$/, "")
    }
    return args
  }

  if (toolName === "fscan_service_bruteforce") {
    try {
      const url = new URL(target)
      args.target = url.hostname
    } catch {
      args.target = target.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/:\d+$/, "")
    }
    args.service = "ssh"
    return args
  }

  if (toolName === "fscan_vuln_scan") {
    try {
      const url = new URL(target)
      args.target = url.hostname
    } catch {
      args.target = target.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/:\d+$/, "")
    }
    return args
  }

  if (toolName === "fscan_web_scan" || toolName === "fscan_full_scan") {
    try {
      const url = new URL(target)
      args.target = url.hostname
    } catch {
      args.target = target.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/:\d+$/, "")
    }
    return args
  }

  // Web probing
  if (toolName === "httpx_probe") {
    args.targets = [target]
    return args
  }

  if (toolName === "httpx_tech_detect") {
    args.targets = [target]
    return args
  }

  // Directory scanning
  if (toolName === "dirsearch_scan" || toolName === "dirsearch_recursive") {
    args.url = target
    return args
  }

  // HTTP interaction
  if (toolName === "http_request") {
    args.url = target
    args.method = "GET"
    return args
  }

  if (toolName === "http_raw_request") {
    try {
      const url = new URL(target)
      args.host = url.hostname
      args.port = Number(url.port) || (url.protocol === "https:" ? 443 : 80)
      args.request = `GET ${url.pathname || "/"} HTTP/1.1\r\nHost: ${url.hostname}\r\n\r\n`
    } catch {
      args.host = target
      args.port = 80
    }
    return args
  }

  if (toolName === "http_batch") {
    args.requests = [{ url: target, method: "GET" }]
    return args
  }

  // TCP/UDP tools
  if (toolName === "tcp_connect" || toolName === "tcp_banner_grab") {
    const parts = target.split(":")
    args.host = parts[0]
    args.port = Number(parts[1]) || 80
    return args
  }

  if (toolName === "udp_send") {
    const parts = target.split(":")
    args.host = parts[0]
    args.port = Number(parts[1]) || 53
    return args
  }

  // WAF detection
  if (toolName === "wafw00f_detect") {
    args.url = target
    return args
  }

  if (toolName === "wafw00f_list") {
    return args
  }

  // Vulnerability scanning
  if (toolName === "afrog_scan") {
    args.target = target
    return args
  }

  if (toolName === "afrog_list_pocs") {
    return args
  }

  // WHOIS tools
  if (toolName === "whois_query") {
    args.domain = target.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/:\d+$/, "")
    return args
  }

  if (toolName === "whois_ip") {
    args.ip = target
    return args
  }

  if (toolName === "icp_query") {
    args.domain = target.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/:\d+$/, "")
    return args
  }

  // FOFA tools
  if (toolName === "fofa_search") {
    args.query = `domain="${target.replace(/^https?:\/\//i, "").replace(/\/.*$/, "")}"`
    return args
  }

  if (toolName === "fofa_host") {
    args.host = target.replace(/^https?:\/\//i, "").replace(/\/.*$/, "")
    return args
  }

  if (toolName === "fofa_stats") {
    args.query = `domain="${target.replace(/^https?:\/\//i, "").replace(/\/.*$/, "")}"`
    return args
  }

  // GitHub tools
  if (toolName === "github_code_search" || toolName === "github_repo_search" || toolName === "github_commit_search") {
    args.query = target.replace(/^https?:\/\//i, "").replace(/\/.*$/, "")
    return args
  }

  // Encode tools
  if (toolName === "encode_decode") {
    args.input = target
    args.operation = "encode"
    args.algorithm = "base64"
    return args
  }

  if (toolName === "hash_compute") {
    args.input = target
    args.algorithm = "md5"
    return args
  }

  if (toolName === "crypto_util") {
    args.operation = "uuid"
    return args
  }

  // Fallback: pass target as generic param
  args.target = target
  return args
}

function resolveServerRecord(toolName: string): McpServerRecord | null {
  // First try platform-registered server
  const registered = findStoredEnabledMcpServerByToolBinding(toolName)

  if (registered) {
    return registered
  }

  // Fall back to discovered config
  const serverKey = getServerKeyByToolName(toolName)

  if (!serverKey) {
    return null
  }

  const config = getDiscoveredMcpServerConfig(serverKey)

  if (!config) {
    return null
  }

  // Build a synthetic McpServerRecord for callMcpServerTool
  return {
    id: `auto-${serverKey}`,
    serverName: `${serverKey}-mcp-server`,
    transport: "stdio",
    command: config.command,
    args: config.args,
    endpoint: "",
    enabled: true,
    status: "已连接",
    toolBindings: [],
    notes: `自动发现 stdio MCP: ${serverKey}`,
    lastSeen: new Date().toISOString(),
  }
}

function getTimeoutForTool(toolName: string): number {
  const mapping = getToolMappingByToolName(toolName)

  if (!mapping) {
    return 120_000
  }

  if (mapping.riskLevel === "高") {
    return 600_000
  }

  if (mapping.capability.includes("端口") || mapping.capability.includes("扫描")) {
    return 300_000
  }

  // Directory/path scanning tools need more time
  if (toolName.includes("dirsearch") || toolName.includes("afrog") || mapping.capability.includes("结构发现")) {
    return 300_000
  }

  return 120_000
}

function parseStructuredContent(rawContent: Array<{ type: string; text?: string }>): Record<string, unknown> {
  for (const entry of rawContent) {
    if (entry.type === "text" && entry.text) {
      try {
        return JSON.parse(entry.text) as Record<string, unknown>
      } catch {
        // Not JSON, continue
      }
    }
  }

  return {}
}

function extractSummaryLines(structured: Record<string, unknown>, toolName: string): string[] {
  const lines: string[] = []

  // Extract summary from common patterns in MCP tool outputs
  if (Array.isArray(structured.domains)) {
    lines.push(`发现 ${structured.domains.length} 个域名/子域`)
  }

  if (Array.isArray(structured.network)) {
    lines.push(`发现 ${structured.network.length} 个网络条目（端口/服务）`)
  }

  if (Array.isArray(structured.webEntries)) {
    lines.push(`发现 ${structured.webEntries.length} 个 Web 入口`)
  }

  if (Array.isArray(structured.findings)) {
    lines.push(`发现 ${structured.findings.length} 个安全发现/漏洞`)
  }

  if (Array.isArray(structured.assets)) {
    lines.push(`发现 ${structured.assets.length} 个资产`)
  }

  if (structured.intelligence && typeof structured.intelligence === "object") {
    lines.push("已获取外部情报信息")
  }

  if (structured.result !== undefined) {
    lines.push(`工具 ${toolName} 已返回结果`)
  }

  if (lines.length === 0) {
    lines.push(`${toolName} 已执行完成`)
  }

  return lines
}

export const stdioMcpConnector: McpConnector = {
  key: "stdio-mcp-generic",
  mode: "real",

  supports({ run }: McpConnectorExecutionContext): boolean {
    // Match any tool that has a known stdio MCP mapping
    return isStdioMcpTool(run.toolName)
  },

  async execute(context: McpConnectorExecutionContext): Promise<McpConnectorResult> {
    throwIfExecutionAborted(context.signal)

    const { run } = context
    const server = resolveServerRecord(run.toolName)

    if (!server) {
      return {
        status: "failed",
        connectorKey: "stdio-mcp-generic",
        mode: "real",
        errorMessage: `未找到 ${run.toolName} 对应的 MCP 服务器配置`,
        summaryLines: [`stdio MCP 连接器无法找到 ${run.toolName} 的服务器配置`],
      }
    }

    const serverKey = getServerKeyByToolName(run.toolName)
    const config = serverKey ? getDiscoveredMcpServerConfig(serverKey) : null

    // Build a server record with correct cwd for stdio transport
    const serverWithCwd: McpServerRecord = config
      ? { ...server, command: config.command, args: config.args }
      : server

    const toolArgs = buildToolArguments(run.toolName, run.target)
    const timeoutMs = getTimeoutForTool(run.toolName)

    try {
      const result = await callMcpServerTool({
        server: serverWithCwd,
        toolName: run.toolName,
        arguments: toolArgs,
        signal: context.signal,
        target: run.target,
        timeoutMs,
        cwd: config?.cwd,
        env: config?.env,
      })

      const structured = result.structuredContent && Object.keys(result.structuredContent).length > 0
        ? result.structuredContent
        : parseStructuredContent(result.content)

      const summaryLines = extractSummaryLines(structured, run.toolName)

      return {
        status: "succeeded",
        connectorKey: "stdio-mcp-generic",
        mode: "real",
        outputs: {},
        rawOutput: result.content
          .filter((entry) => entry.type === "text" && entry.text)
          .map((entry) => entry.text as string),
        structuredContent: structured,
        summaryLines: [
          `真实 stdio MCP (${run.toolName}) 执行成功`,
          ...summaryLines,
        ],
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `${run.toolName} 执行失败`

      if (message.includes("超时")) {
        return {
          status: "retryable_failure",
          connectorKey: "stdio-mcp-generic",
          mode: "real",
          summaryLines: [`${run.toolName} 执行超时（>${timeoutMs}ms）`],
          errorMessage: message,
          retryAfterMinutes: 5,
        }
      }

      return {
        status: "failed",
        connectorKey: "stdio-mcp-generic",
        mode: "real",
        summaryLines: [`${run.toolName} 执行失败: ${message}`],
        errorMessage: message,
      }
    }
  },
}
