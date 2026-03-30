import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { registerStoredMcpServer } from "@/lib/mcp-server-repository"
import { formatTimestamp } from "@/lib/prototype-record-utils"
import { prisma } from "@/lib/prisma"
import { fromLogRecord } from "@/lib/prisma-transforms"
import type { McpServerRegistrationInput } from "@/lib/mcp-registration-schema"

type McpServersJsonEntry = {
  command: string
  args: string[]
  cwd: string
  env?: Record<string, string>
}

type McpServersJson = {
  mcpServers: Record<string, McpServersJsonEntry>
}

type ToolMapping = {
  toolName: string
  title: string
  description: string
  capability: string
  boundary: "外部目标交互" | "平台内部处理" | "外部第三方API"
  riskLevel: "高" | "中" | "低"
  requiresApproval: boolean
  resultMappings: string[]
}

const TOOL_REGISTRY: Record<string, ToolMapping[]> = {
  subfinder: [
    {
      toolName: "subfinder_enum",
      title: "子域名枚举",
      description: "被动子域名枚举，从多个来源收集子域信息",
      capability: "DNS / 子域 / 证书情报类",
      boundary: "外部目标交互",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["domains", "assets"],
    },
    {
      toolName: "subfinder_verify",
      title: "子域名验证",
      description: "枚举并验证子域名的 DNS 解析",
      capability: "DNS / 子域 / 证书情报类",
      boundary: "外部目标交互",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["domains", "assets"],
    },
  ],
  fscan: [
    {
      toolName: "fscan_host_discovery",
      title: "主机发现",
      description: "ICMP/ping 扫描发现存活主机",
      capability: "端口探测类",
      boundary: "外部目标交互",
      riskLevel: "中",
      requiresApproval: false,
      resultMappings: ["assets", "network"],
    },
    {
      toolName: "fscan_port_scan",
      title: "端口扫描",
      description: "扫描开放端口并识别服务",
      capability: "端口探测类",
      boundary: "外部目标交互",
      riskLevel: "中",
      requiresApproval: false,
      resultMappings: ["network", "assets"],
    },
    {
      toolName: "fscan_service_bruteforce",
      title: "服务爆破",
      description: "对 23 种服务进行凭据爆破测试",
      capability: "受控验证类",
      boundary: "外部目标交互",
      riskLevel: "高",
      requiresApproval: true,
      resultMappings: ["findings"],
    },
    {
      toolName: "fscan_vuln_scan",
      title: "漏洞扫描",
      description: "扫描已知漏洞（MS17-010, SMBGhost）",
      capability: "受控验证类",
      boundary: "外部目标交互",
      riskLevel: "高",
      requiresApproval: true,
      resultMappings: ["findings"],
    },
    {
      toolName: "fscan_web_scan",
      title: "Web 漏洞扫描",
      description: "使用 POC 进行 Web 应用漏洞检测",
      capability: "受控验证类",
      boundary: "外部目标交互",
      riskLevel: "高",
      requiresApproval: true,
      resultMappings: ["findings"],
    },
    {
      toolName: "fscan_full_scan",
      title: "综合扫描",
      description: "主机发现 + 端口扫描 + 服务爆破 + 漏洞扫描的综合模式",
      capability: "受控验证类",
      boundary: "外部目标交互",
      riskLevel: "高",
      requiresApproval: true,
      resultMappings: ["network", "findings", "assets"],
    },
  ],
  httpx: [
    {
      toolName: "httpx_probe",
      title: "Web 存活探测",
      description: "检测目标 Web 服务是否存活",
      capability: "Web 页面探测类",
      boundary: "外部目标交互",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["webEntries", "assets"],
    },
    {
      toolName: "httpx_tech_detect",
      title: "技术栈识别",
      description: "识别目标使用的框架、服务器、库等技术栈",
      capability: "Web 页面探测类",
      boundary: "外部目标交互",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["webEntries", "assets"],
    },
  ],
  dirsearch: [
    {
      toolName: "dirsearch_scan",
      title: "目录枚举",
      description: "扫描目标隐藏目录和文件",
      capability: "HTTP / API 结构发现类",
      boundary: "外部目标交互",
      riskLevel: "中",
      requiresApproval: false,
      resultMappings: ["webEntries", "assets"],
    },
    {
      toolName: "dirsearch_recursive",
      title: "递归目录枚举",
      description: "深层递归扫描目录结构",
      capability: "HTTP / API 结构发现类",
      boundary: "外部目标交互",
      riskLevel: "中",
      requiresApproval: false,
      resultMappings: ["webEntries", "assets"],
    },
  ],
  curl: [
    {
      toolName: "http_request",
      title: "HTTP 请求",
      description: "发送自定义 HTTP 请求",
      capability: "HTTP 数据包交互类",
      boundary: "外部目标交互",
      riskLevel: "中",
      requiresApproval: false,
      resultMappings: ["evidence"],
    },
    {
      toolName: "http_raw_request",
      title: "原始 HTTP 请求",
      description: "通过 TCP socket 发送原始 HTTP 数据包",
      capability: "HTTP 数据包交互类",
      boundary: "外部目标交互",
      riskLevel: "中",
      requiresApproval: false,
      resultMappings: ["evidence"],
    },
    {
      toolName: "http_batch",
      title: "批量 HTTP 请求",
      description: "并发发送多个 HTTP 请求",
      capability: "HTTP 数据包交互类",
      boundary: "外部目标交互",
      riskLevel: "中",
      requiresApproval: false,
      resultMappings: ["evidence"],
    },
  ],
  netcat: [
    {
      toolName: "tcp_connect",
      title: "TCP 连接",
      description: "TCP 连接并可选发送数据",
      capability: "TCP 数据包交互类",
      boundary: "外部目标交互",
      riskLevel: "中",
      requiresApproval: false,
      resultMappings: ["evidence"],
    },
    {
      toolName: "udp_send",
      title: "UDP 发送",
      description: "发送 UDP 数据包",
      capability: "TCP 数据包交互类",
      boundary: "外部目标交互",
      riskLevel: "中",
      requiresApproval: false,
      resultMappings: ["evidence"],
    },
    {
      toolName: "tcp_banner_grab",
      title: "Banner 抓取",
      description: "连接目标端口读取 banner 信息",
      capability: "TCP 数据包交互类",
      boundary: "外部目标交互",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["evidence", "assets"],
    },
  ],
  wafw00f: [
    {
      toolName: "wafw00f_detect",
      title: "WAF 检测",
      description: "检测目标是否部署了 WAF 及其类型",
      capability: "Web 页面探测类",
      boundary: "外部目标交互",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["findings", "evidence"],
    },
    {
      toolName: "wafw00f_list",
      title: "WAF 指纹列表",
      description: "列出支持识别的 WAF 类型",
      capability: "Web 页面探测类",
      boundary: "平台内部处理",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["evidence"],
    },
  ],
  afrog: [
    {
      toolName: "afrog_scan",
      title: "POC 漏洞扫描",
      description: "使用 POC 进行漏洞扫描（1699+ POC）",
      capability: "受控验证类",
      boundary: "外部目标交互",
      riskLevel: "高",
      requiresApproval: true,
      resultMappings: ["findings"],
    },
    {
      toolName: "afrog_list_pocs",
      title: "列出可用 POC",
      description: "列出可用的漏洞 POC 列表",
      capability: "受控验证类",
      boundary: "平台内部处理",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["evidence"],
    },
  ],
  whois: [
    {
      toolName: "whois_query",
      title: "域名 WHOIS 查询",
      description: "查询域名注册信息",
      capability: "外部情报查询类",
      boundary: "外部第三方API",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["intelligence", "evidence"],
    },
    {
      toolName: "whois_ip",
      title: "IP WHOIS 查询",
      description: "查询 IP 归属信息",
      capability: "外部情报查询类",
      boundary: "外部第三方API",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["intelligence", "evidence"],
    },
    {
      toolName: "icp_query",
      title: "ICP 备案查询",
      description: "查询中国域名 ICP 备案信息",
      capability: "外部情报查询类",
      boundary: "外部第三方API",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["intelligence", "evidence"],
    },
  ],
  fofa: [
    {
      toolName: "fofa_search",
      title: "FOFA 资产搜索",
      description: "通过 FOFA 搜索引擎查找资产",
      capability: "外部情报查询类",
      boundary: "外部第三方API",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["intelligence", "assets"],
    },
    {
      toolName: "fofa_host",
      title: "FOFA 主机详情",
      description: "获取特定主机的 FOFA 详细信息",
      capability: "外部情报查询类",
      boundary: "外部第三方API",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["intelligence", "assets"],
    },
    {
      toolName: "fofa_stats",
      title: "FOFA 统计",
      description: "获取搜索结果的统计数据",
      capability: "外部情报查询类",
      boundary: "外部第三方API",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["intelligence"],
    },
  ],
  "github-recon": [
    {
      toolName: "github_code_search",
      title: "GitHub 代码搜索",
      description: "搜索 GitHub 上的代码泄露和敏感信息",
      capability: "外部情报查询类",
      boundary: "外部第三方API",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["intelligence", "evidence"],
    },
    {
      toolName: "github_repo_search",
      title: "GitHub 仓库搜索",
      description: "搜索相关的 GitHub 仓库",
      capability: "外部情报查询类",
      boundary: "外部第三方API",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["intelligence"],
    },
    {
      toolName: "github_commit_search",
      title: "GitHub 提交搜索",
      description: "搜索相关的 Git 提交记录",
      capability: "外部情报查询类",
      boundary: "外部第三方API",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["intelligence"],
    },
  ],
  encode: [
    {
      toolName: "encode_decode",
      title: "编解码",
      description: "Base64/URL/Hex/HTML/Unicode 编解码",
      capability: "编解码与密码学工具类",
      boundary: "平台内部处理",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["evidence"],
    },
    {
      toolName: "hash_compute",
      title: "哈希计算",
      description: "计算 MD5/SHA1/SHA256 等各种哈希",
      capability: "编解码与密码学工具类",
      boundary: "平台内部处理",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["evidence"],
    },
    {
      toolName: "crypto_util",
      title: "密码学工具",
      description: "JWT 解码、UUID 生成、AES 加解密等",
      capability: "编解码与密码学工具类",
      boundary: "平台内部处理",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["evidence"],
    },
  ],
  script: [
    {
      toolName: "execute_code",
      title: "Node.js 代码执行",
      description: "执行 LLM 自主生成的 Node.js 代码，用于自定义网络探测、漏洞验证、数据分析等场景",
      capability: "脚本执行与自动化类",
      boundary: "外部目标交互",
      riskLevel: "高",
      requiresApproval: true,
      resultMappings: ["evidence", "findings"],
    },
    {
      toolName: "execute_command",
      title: "Shell 命令执行",
      description: "执行 Shell 命令，调用系统工具（curl/nmap/python/dig 等）进行自定义攻击和探测",
      capability: "脚本执行与自动化类",
      boundary: "外部目标交互",
      riskLevel: "高",
      requiresApproval: true,
      resultMappings: ["evidence", "findings"],
    },
    {
      toolName: "read_file",
      title: "文件读取",
      description: "读取文件内容，用于获取脚本输出、配置文件、分析结果等",
      capability: "脚本执行与自动化类",
      boundary: "平台内部处理",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["evidence"],
    },
    {
      toolName: "write_file",
      title: "文件写入",
      description: "写入文件内容，用于保存脚本、攻击载荷、分析结果、证据等",
      capability: "脚本执行与自动化类",
      boundary: "平台内部处理",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["evidence"],
    },
  ],
}

function getMcpsDirectory() {
  return path.join(process.cwd(), "mcps")
}

function loadMcpServersJson(): McpServersJson | null {
  const configPath = path.join(getMcpsDirectory(), "mcp-servers.json")

  if (!existsSync(configPath)) {
    return null
  }

  try {
    return JSON.parse(readFileSync(configPath, "utf-8")) as McpServersJson
  } catch {
    return null
  }
}

function discoverMcpServerDirs(): string[] {
  const mcpsDir = getMcpsDirectory()

  if (!existsSync(mcpsDir)) {
    return []
  }

  return readdirSync(mcpsDir, { withFileTypes: true })
    .filter((entry) => {
      if (!entry.isDirectory()) {
        return false
      }

      const hasPackageJson = existsSync(path.join(mcpsDir, entry.name, "package.json"))
      const hasIndexTs = existsSync(path.join(mcpsDir, entry.name, "src", "index.ts"))

      return hasPackageJson && hasIndexTs
    })
    .map((entry) => entry.name)
}

function resolveServerKey(dirName: string): string {
  return dirName.replace(/-mcp-server$/, "")
}

function buildToolRegistrationInput(
  serverKey: string,
  tools: ToolMapping[],
  serverConfig: McpServersJsonEntry,
): McpServerRegistrationInput {
  return {
    serverName: `${serverKey}-mcp-server`,
    version: "1.0.0",
    transport: "stdio" as const,
    command: serverConfig.command,
    args: serverConfig.args,
    enabled: true,
    notes: `自动发现于 mcps/${serverKey}-mcp-server`,
    tools: tools.map((tool) => ({
      toolName: tool.toolName,
      title: tool.title,
      description: tool.description,
      version: "1.0.0",
      capability: tool.capability as typeof import("@/lib/platform-config").MCP_CAPABILITY_NAMES[number],
      boundary: tool.boundary,
      riskLevel: tool.riskLevel,
      requiresApproval: tool.requiresApproval,
      resultMappings: tool.resultMappings as Array<typeof import("@/lib/platform-config").MCP_RESULT_MAPPINGS[number]>,
      inputSchema: { type: "object", properties: {} },
      outputSchema: { type: "object", properties: {} },
      defaultConcurrency: "1",
      rateLimit: "10/min",
      timeout: tool.riskLevel === "高" ? "600s" : "300s",
      retry: "1",
      owner: "platform-auto-discovery",
    })),
  }
}

export async function discoverAndRegisterMcpServers() {
  const config = loadMcpServersJson()
  const dirs = discoverMcpServerDirs()

  if (!config || dirs.length === 0) {
    return {
      discovered: 0,
      registered: 0,
      servers: [] as string[],
      errors: [] as string[],
    }
  }

  const registered: string[] = []
  const errors: string[] = []

  for (const dirName of dirs) {
    const serverKey = resolveServerKey(dirName)
    const serverConfig = config.mcpServers[serverKey]
    const toolMappings = TOOL_REGISTRY[serverKey]

    if (!serverConfig) {
      errors.push(`${serverKey}: 在 mcp-servers.json 中未找到配置`)
      continue
    }

    if (!toolMappings || toolMappings.length === 0) {
      errors.push(`${serverKey}: 没有已知的工具映射`)
      continue
    }

    try {
      const input = buildToolRegistrationInput(serverKey, toolMappings, serverConfig)
      await registerStoredMcpServer(input)
      registered.push(serverKey)
    } catch (error) {
      errors.push(`${serverKey}: ${error instanceof Error ? error.message : "注册失败"}`)
    }
  }

  if (registered.length > 0) {
    await prisma.auditLog.create({
      data: fromLogRecord({
        id: `audit-auto-discovery-${Date.now()}`,
        category: "MCP 自动发现",
        summary: `自动发现并注册 ${registered.length} 个 MCP 服务器：${registered.join(", ")}`,
        actor: "平台启动",
        timestamp: formatTimestamp(),
        status: "已完成",
      }),
    })
  }

  return {
    discovered: dirs.length,
    registered: registered.length,
    servers: registered,
    errors,
  }
}

function resolveEnvPaths(env: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = {}

  for (const [key, value] of Object.entries(env)) {
    // Resolve env values that look like relative file paths to absolute
    if (value && /^[a-zA-Z0-9._-]/.test(value) && value.includes("/") && !value.includes(" ") && !value.startsWith("http")) {
      resolved[key] = path.resolve(process.cwd(), value)
    } else {
      resolved[key] = value
    }
  }

  return resolved
}

export function getDiscoveredMcpServerConfig(serverKey: string) {
  const config = loadMcpServersJson()

  if (!config) {
    return null
  }

  const serverConfig = config.mcpServers[serverKey]

  if (!serverConfig) {
    return null
  }

  return {
    command: serverConfig.command,
    args: serverConfig.args,
    cwd: path.resolve(process.cwd(), serverConfig.cwd),
    env: resolveEnvPaths(serverConfig.env ?? {}),
  }
}

export function getToolMappingByToolName(toolName: string): ToolMapping | null {
  for (const tools of Object.values(TOOL_REGISTRY)) {
    const found = tools.find((tool) => tool.toolName === toolName)

    if (found) {
      return found
    }
  }

  return null
}

export function getServerKeyByToolName(toolName: string): string | null {
  for (const [serverKey, tools] of Object.entries(TOOL_REGISTRY)) {
    if (tools.some((tool) => tool.toolName === toolName)) {
      return serverKey
    }
  }

  return null
}
