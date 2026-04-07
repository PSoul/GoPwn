/**
 * MCP tool registry — manages connectors for registered MCP servers.
 * Provides a unified interface to call any registered tool.
 */

import type { McpConnector, McpToolInput, McpToolResult } from "./connector"
import { createStdioConnector } from "./stdio-connector"
import * as mcpToolRepo from "@/lib/repositories/mcp-tool-repo"

// Cache connectors by server name to avoid re-spawning processes
const connectorCache = new Map<string, McpConnector>()

// Prevent concurrent getConnector() from spawning duplicate processes
const inflightConnectors = new Map<string, Promise<McpConnector | null>>()

/**
 * Get or create a connector for a given server.
 * Uses an inflight map to prevent concurrent calls from creating duplicate processes.
 */
async function getConnector(serverName: string): Promise<McpConnector | null> {
  // Fast path: already cached and healthy
  if (connectorCache.has(serverName)) {
    // Still verify server is enabled
    const servers = await mcpToolRepo.findAllServers()
    const server = servers.find((s) => s.serverName === serverName && s.enabled)
    if (server) return connectorCache.get(serverName)!
    // Server disabled — evict
    const old = connectorCache.get(serverName)!
    connectorCache.delete(serverName)
    await old.close().catch(() => {})
    return null
  }

  // Prevent duplicate spawns: if another call is already creating this connector, wait for it
  if (inflightConnectors.has(serverName)) {
    return inflightConnectors.get(serverName)!
  }

  const promise = createConnector(serverName)
  inflightConnectors.set(serverName, promise)
  try {
    return await promise
  } finally {
    inflightConnectors.delete(serverName)
  }
}

async function createConnector(serverName: string): Promise<McpConnector | null> {
  const servers = await mcpToolRepo.findAllServers()
  const server = servers.find((s) => s.serverName === serverName && s.enabled)
  if (!server) return null

  if (server.transport === "stdio" && server.command) {
    const envVars = server.envJson ? JSON.parse(server.envJson) as Record<string, string> : undefined
    const connector = createStdioConnector({
      command: server.command,
      args: server.args,
      cwd: server.cwd ?? undefined,
      env: envVars,
      timeoutMs: 120_000,
    })
    connectorCache.set(serverName, connector)
    return connector
  }

  console.warn(`[mcp-registry] Unsupported transport "${server.transport}" for ${serverName}`)
  return null
}

/**
 * Call a tool by name. Resolves the correct connector from the tool's server.
 */
export async function callTool(toolName: string, input: McpToolInput): Promise<McpToolResult> {
  const tool = await mcpToolRepo.findByToolName(toolName)
  if (!tool) {
    return {
      content: `Tool "${toolName}" not found in registry`,
      isError: true,
      durationMs: 0,
    }
  }

  if (!tool.enabled) {
    return {
      content: `Tool "${toolName}" is disabled`,
      isError: true,
      durationMs: 0,
    }
  }

  const connector = await getConnector(tool.serverName)
  if (!connector) {
    return {
      content: `MCP server "${tool.serverName}" is not available`,
      isError: true,
      durationMs: 0,
    }
  }

  return connector.callTool(toolName, input)
}

/**
 * Discover and sync tools from all enabled MCP servers.
 * Fetches tool lists from each server and upserts into the database.
 */
export async function syncToolsFromServers(): Promise<{ synced: number; errors: string[] }> {
  const servers = await mcpToolRepo.findAllServers()
  const enabledServers = servers.filter((s) => s.enabled)

  let synced = 0
  const errors: string[] = []

  for (const server of enabledServers) {
    try {
      const connector = await getConnector(server.serverName)
      if (!connector) {
        errors.push(`Cannot create connector for ${server.serverName}`)
        continue
      }

      const tools = await connector.listTools()
      for (const tool of tools) {
        await mcpToolRepo.upsert({
          serverName: server.serverName,
          toolName: tool.name,
          capability: inferCapability(tool.name, tool.description),
          description: tool.description,
          inputSchema: tool.inputSchema as Record<string, unknown>,
        })
        synced++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${server.serverName}: ${msg}`)
    }
  }

  return { synced, errors }
}

/**
 * Close all cached connectors. Call this on worker shutdown.
 */
export async function closeAll(): Promise<void> {
  for (const [, connector] of connectorCache) {
    await connector.close().catch(() => {})
  }
  connectorCache.clear()
}

/**
 * Infer a capability category from tool name and description.
 * Categories align with the pentest methodology's "能力族" (capability families).
 * Order matters: more specific patterns match first.
 */
function inferCapability(name: string, description: string): string {
  // Code/command execution — match on raw name before lowercasing to avoid false positives
  if (name === "execute_code" || name === "execute_command") return "code_execution"

  const text = `${name} ${description}`.toLowerCase()

  // DNS / subdomain / certificate intelligence
  if (text.includes("subdomain") || text.includes("subfinder")) return "dns_subdomain"
  if (text.includes("whois") || text.includes("icp")) return "dns_whois"
  if (text.includes("dns")) return "dns_enum"

  // External intelligence (FOFA, GitHub recon)
  if (text.includes("fofa") || text.includes("shodan")) return "external_intel"
  if (text.includes("github") && (text.includes("recon") || text.includes("search"))) return "external_intel"

  // Port scanning / host discovery / service identification
  if (text.includes("host_discovery") || text.includes("alive")) return "host_discovery"
  if (text.includes("port") && text.includes("scan")) return "port_scan"
  if (text.includes("full_scan") || text.includes("comprehensive")) return "asset_scan"
  if (text.includes("bruteforce") || text.includes("brute")) return "credential_test"

  // Web probing / tech detection / WAF
  if (text.includes("waf") || text.includes("wafw00f")) return "waf_detection"
  if (text.includes("tech_detect") || text.includes("technology") || text.includes("fingerprint")) return "fingerprint"
  if (text.includes("httpx") || (text.includes("probe") && text.includes("alive"))) return "web_probe"

  // HTTP/API structure discovery (directory scan, path enum)
  if (text.includes("dirsearch") || text.includes("directory") || text.includes("recursive")) return "web_crawl"

  // HTTP packet interaction
  if (text.includes("http_request") || text.includes("http_raw") || text.includes("http_batch")) return "http_interaction"
  if (text.includes("curl") && text.includes("request")) return "http_interaction"

  // TCP/UDP packet interaction
  if (text.includes("tcp_connect") || text.includes("tcp_banner") || text.includes("netcat")) return "tcp_interaction"
  if (text.includes("udp")) return "tcp_interaction"

  // POC / vulnerability scanning
  if (text.includes("vuln") || text.includes("poc") || text.includes("afrog")) return "vuln_scan"
  if (text.includes("web_scan") && text.includes("vuln")) return "vuln_scan"

  // Encode/decode / crypto
  if (text.includes("encode") || text.includes("decode") || text.includes("hash") || text.includes("crypto") || text.includes("jwt")) return "crypto_tool"

  // File operations
  if (text.includes("read_file") || text.includes("write_file")) return "file_io"

  // Screenshot / evidence
  if (text.includes("screenshot") || text.includes("capture")) return "screenshot"

  return "general"
}
