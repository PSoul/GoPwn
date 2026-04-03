import { callMcpServerTool } from "@/lib/mcp/mcp-client-service"
import { getDiscoveredMcpServerConfig, getServerKeyByToolName, getToolMappingByToolName } from "@/lib/mcp/mcp-auto-discovery"
import { throwIfExecutionAborted } from "@/lib/mcp/mcp-execution-abort"
import { findStoredEnabledMcpServerByToolBinding } from "@/lib/mcp/mcp-server-repository"
import type { McpConnector, McpConnectorExecutionContext, McpConnectorResult } from "@/lib/mcp-connectors/types"
import type { McpServerRecord } from "@/lib/prototype-types"

/**
 * Transient store for LLM-generated execute_code scripts, keyed by MCP run ID.
 * The code is set at dispatch time and consumed once at execution time.
 */
const _llmCodeStore = new Map<string, string>()

/** Store LLM-generated code for a run (called from dispatch) */
export function setLlmCodeForRun(runId: string, code: string) {
  _llmCodeStore.set(runId, code)
}

/** Consume LLM-generated code for a run (called once during execution) */
function consumeLlmCodeForRun(runId: string): string | undefined {
  const code = _llmCodeStore.get(runId)
  if (code) _llmCodeStore.delete(runId)
  return code
}

function isStdioMcpTool(toolName: string): boolean {
  return getServerKeyByToolName(toolName) !== null
}

function normalizeTargetForHost(target: string): string {
  // host.docker.internal is only resolvable inside Docker containers.
  // MCP tools run on the host, so replace with localhost for connectivity.
  return target.replace(/host\.docker\.internal/gi, "localhost")
}

/**
 * Generate a generic probe script based on target type (TCP service vs HTTP).
 * TCP: banner grab + protocol auto-detection from response content (not port number).
 * HTTP: page identification + form/link discovery + security header check.
 * This is a fallback — LLM-generated code (via setLlmCodeForRun) takes priority.
 */
function buildExecuteCodeScript(target: string): string {
  // TCP target: generic banner-based protocol detection
  if (/^tcp:\/\//i.test(target) || (!target.startsWith("http") && /:\d+$/.test(target))) {
    const cleaned = target.replace(/^tcp:\/\//i, "")
    const [host, portStr] = cleaned.split(":")
    const port = portStr || "80"
    return `
const net = require('net');
const client = new net.Socket();
client.setTimeout(10000);
const host = ${JSON.stringify(host)};
const port = ${port};
client.connect(port, host, () => {
  setTimeout(() => { try { client.write('\\r\\n'); } catch {} }, 500);
});
let data = Buffer.alloc(0);
client.on('data', (chunk) => {
  data = Buffer.concat([data, chunk]);
  const text = data.toString('utf8');
  if (text.includes('redis_version') || text.match(/^\\+|^-ERR|^\\$/m)) {
    console.log(JSON.stringify({ service: 'Redis', port, banner: text.slice(0, 500), detail: 'Redis协议特征已识别' }));
    client.destroy();
  } else if (text.startsWith('SSH-')) {
    console.log(JSON.stringify({ service: 'SSH', port, banner: text.trim().slice(0, 200), detail: 'SSH Banner已获取' }));
    client.destroy();
  } else if (data.length > 4 && data[3] === 0 && data[4] === 10) {
    try {
      const version = data.slice(5, data.indexOf(0, 5)).toString('utf8');
      console.log(JSON.stringify({ service: 'MySQL', port, version, detail: 'MySQL握手包已获取' }));
    } catch { console.log(JSON.stringify({ service: 'MySQL', port, detail: 'MySQL协议特征已识别' })); }
    client.destroy();
  } else if (text.includes('MongoDB') || (data.length > 20 && data[12] === 1)) {
    console.log(JSON.stringify({ service: 'MongoDB', port, banner: text.slice(0, 200), detail: 'MongoDB协议特征已识别' }));
    client.destroy();
  } else if (text.match(/^220[ -]/m)) {
    console.log(JSON.stringify({ service: 'FTP/SMTP', port, banner: text.trim().slice(0, 200), detail: '220状态码服务Banner' }));
    client.destroy();
  } else if (data.length > 50) {
    console.log(JSON.stringify({ service: 'unknown', port, banner: text.slice(0, 500), responseBytes: data.length, detail: '已获取服务响应，协议待识别' }));
    client.destroy();
  }
});
client.on('timeout', () => {
  if (data.length > 0) {
    console.log(JSON.stringify({ service: 'unknown', port, banner: data.toString('utf8').slice(0, 500), responseBytes: data.length, detail: '连接超时前已获取部分响应' }));
  } else {
    console.log(JSON.stringify({ error: 'connection timeout', port, detail: '连接超时，未获取到服务响应' }));
  }
  client.destroy();
});
client.on('error', (e) => { console.log(JSON.stringify({ error: e.message, port })); });
`.trim()
  }

  // HTTP target: generic page identification + structure discovery
  const url = target.startsWith("http") ? target : `http://${target}`
  return `
const http = require('http');
const https = require('https');
const baseUrl = '${url}';
const u = new URL(baseUrl);
const httpMod = u.protocol === 'https:' ? https : http;
const results = [];

function request(options) {
  return new Promise((resolve) => {
    const req = httpMod.request({
      hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
      timeout: 10000, rejectUnauthorized: false, ...options
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function run() {
  // Step 1: Identify the application
  const home = await request({ path: u.pathname || '/', method: 'GET' });
  if (!home) { console.log(JSON.stringify({ error: 'target unreachable', url: baseUrl })); return; }
  const title = (home.body.match(/<title>([^<]*)<\\/title>/i) || [])[1] || '';
  const server = home.headers['server'] || '';
  const poweredBy = home.headers['x-powered-by'] || '';
  results.push({ step: 'identify', url: baseUrl, title, server, poweredBy, status: home.status, contentLength: home.body.length });

  // Step 2: Discover forms and input surfaces
  const formMatches = home.body.match(/<form[^>]*>[\\s\\S]*?<\\/form>/gi) || [];
  const forms = formMatches.map((f, i) => {
    const action = (f.match(/action=['"]([^'"]*)/i) || [])[1] || '';
    const method = (f.match(/method=['"]([^'"]*)/i) || [])[1] || 'GET';
    const inputs = (f.match(/<input[^>]*>/gi) || []).map(inp => {
      const name = (inp.match(/name=['"]([^'"]*)/i) || [])[1] || '';
      const type = (inp.match(/type=['"]([^'"]*)/i) || [])[1] || 'text';
      return { name, type };
    }).filter(inp => inp.name);
    return { index: i, action, method, inputs };
  });
  if (forms.length > 0) results.push({ step: 'forms', count: forms.length, forms: forms.slice(0, 10) });

  // Step 3: Discover links for further exploration
  const linkMatches = home.body.match(/href=['"]([^'"#][^'"]*)/gi) || [];
  const links = [...new Set(linkMatches.map(l => l.replace(/^href=['"]/i, '')).filter(l => l.startsWith('/') || l.startsWith(baseUrl)))].slice(0, 30);
  if (links.length > 0) results.push({ step: 'links', count: links.length, links });

  // Step 4: Check response headers for security-relevant info
  const secHeaders = {};
  for (const h of ['content-security-policy', 'x-frame-options', 'x-content-type-options', 'strict-transport-security', 'x-xss-protection', 'set-cookie']) {
    if (home.headers[h]) secHeaders[h] = Array.isArray(home.headers[h]) ? home.headers[h].join('; ') : home.headers[h];
  }
  if (Object.keys(secHeaders).length > 0) results.push({ step: 'security_headers', headers: secHeaders });

  // Output results
  for (const r of results) { console.log(JSON.stringify(r)); }
  if (results.length <= 1) {
    console.log(JSON.stringify({ status: 'minimal_info', title, server, note: 'Fallback探测仅获取到基础信息，LLM应根据结果规划进一步测试策略' }));
  }
}
run().catch(e => console.log(JSON.stringify({ error: e.message })));
`.trim()
}

function buildToolArguments(toolName: string, rawTarget: string, llmCode?: string): Record<string, unknown> {
  // Map platform requestedAction/target to MCP tool-specific parameters
  const target = normalizeTargetForHost(rawTarget)
  const args: Record<string, unknown> = {}

  // DNS / subdomain tools
  if (toolName === "subfinder_enum" || toolName === "subfinder_verify") {
    args.target = target.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/:\d+$/, "")
    return args
  }

  // Port scanning tools -- fscan expects IP or CIDR, not a URL
  if (toolName === "fscan_host_discovery" || toolName === "fscan_port_scan") {
    // Handle tcp://host:port format
    const tcpFscanMatch = target.match(/^tcp:\/\/([^:]+):(\d+)$/i)

    if (tcpFscanMatch) {
      args.target = tcpFscanMatch[1]

      if (toolName === "fscan_port_scan") {
        args.ports = tcpFscanMatch[2]
      }

      return args
    }

    try {
      const url = new URL(target)
      args.target = url.hostname
      // If the URL has a non-standard port, pass it so fscan scans that specific port
      if (url.port && toolName === "fscan_port_scan") {
        args.ports = url.port
      }
    } catch {
      // Handle bare host:port
      const colonIdx = target.lastIndexOf(":")
      if (colonIdx > 0 && /^\d+$/.test(target.slice(colonIdx + 1))) {
        args.target = target.slice(0, colonIdx)
        if (toolName === "fscan_port_scan") {
          args.ports = target.slice(colonIdx + 1)
        }
      } else {
        args.target = target.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/:\d+$/, "")
      }
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
      args.rawRequest = `GET ${url.pathname || "/"} HTTP/1.1\r\nHost: ${url.hostname}\r\n\r\n`
      args.tls = url.protocol === "https:"
    } catch {
      args.host = target
      args.port = 80
      args.rawRequest = `GET / HTTP/1.1\r\nHost: ${target}\r\n\r\n`
    }
    return args
  }

  if (toolName === "http_batch") {
    args.requests = [{ url: target, method: "GET" }]
    return args
  }

  // TCP/UDP tools — handle tcp://host:port, host:port, and URL formats
  if (toolName === "tcp_connect" || toolName === "tcp_banner_grab") {
    const tcpMatch = target.match(/^tcp:\/\/([^:]+):(\d+)$/i)

    if (tcpMatch) {
      args.host = tcpMatch[1]
      args.port = Number(tcpMatch[2])
      return args
    }

    // Try URL format (http://host:port)
    try {
      const url = new URL(target)
      args.host = url.hostname
      args.port = Number(url.port) || (url.protocol === "https:" ? 443 : 80)
      return args
    } catch {
      // Fall through to bare host:port
    }

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
    args.query = target.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/:\d+$/, "")
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

  // Script execution tools — these get special parameter handling
  if (toolName === "execute_code") {
    // LLM-generated code takes priority over fallback script
    args.code = llmCode || buildExecuteCodeScript(target);
    args.description = llmCode ? `LLM 自主脚本: ${target}` : `自动探测 ${target}`;
    args.timeout_seconds = 30;
    return args;
  }

  if (toolName === "execute_command") {
    args.command = target.startsWith("tcp://")
      ? `echo PING | nc -w 3 ${target.replace("tcp://", "").replace(":", " ")} 2>&1 || echo CONNECTION_FAILED`
      : `curl -s -o /dev/null -w "%{http_code}" "${target}"`;
    args.description = `Shell 探测 ${target}`;
    args.timeout_seconds = 15;
    return args;
  }

  if (toolName === "read_file") {
    args.path = target;
    return args;
  }

  if (toolName === "write_file") {
    args.path = target;
    args.content = "";
    args.description = "LLM 生成文件";
    return args;
  }

  // Fallback: pass target as generic param
  args.target = target
  return args
}

async function resolveServerRecord(toolName: string): Promise<McpServerRecord | null> {
  // First try platform-registered server
  const registered = await findStoredEnabledMcpServerByToolBinding(toolName)

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

  // TCP connect / banner grab results
  if (structured.connected === true) {
    const banner = typeof structured.banner === "string" ? structured.banner.trim().slice(0, 60) : ""
    lines.push(banner ? `TCP 连接成功，Banner: ${banner}` : "TCP 连接成功")
  } else if (structured.connected === false) {
    lines.push("TCP 连接失败（端口关闭或不可达）")
  }
  if (typeof structured.banner === "string" && structured.connected === undefined) {
    lines.push(`Banner: ${structured.banner.trim().slice(0, 60)}`)
  }

  // WHOIS results
  if (typeof structured.registrar === "string" || typeof structured.org === "string") {
    const info = structured.registrar ?? structured.org ?? ""
    lines.push(`WHOIS 信息: ${String(info).slice(0, 60)}`)
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
    const server = await resolveServerRecord(run.toolName)

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

    const llmCode = consumeLlmCodeForRun(run.id)
    const toolArgs = buildToolArguments(run.toolName, run.target, llmCode)
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

      if (message.includes("超时") || message.includes("timed out") || message.includes("Timeout")) {
        return {
          status: "retryable_failure",
          connectorKey: "stdio-mcp-generic",
          mode: "real",
          summaryLines: [`${run.toolName} 执行超时（>${timeoutMs}ms）`],
          errorMessage: message,
          retryAfterMinutes: 5,
        }
      }

      // ENOENT = binary not found — give a clear actionable message
      if (message.includes("ENOENT") || message.includes("not found")) {
        const serverKey = getServerKeyByToolName(run.toolName)
        const envHint = serverKey ? `检查 mcps/mcp-servers.json 中 ${serverKey} 的二进制路径配置` : ""
        return {
          status: "failed",
          connectorKey: "stdio-mcp-generic",
          mode: "real",
          summaryLines: [
            `${run.toolName} 所需的可执行文件不存在`,
            envHint,
            "请下载对应的二进制文件并放置到正确路径，或设置对应的环境变量",
          ].filter(Boolean),
          errorMessage: `二进制文件缺失: ${message}`,
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
