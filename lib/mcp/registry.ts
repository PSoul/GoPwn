/**
 * MCP tool registry — manages connectors for registered MCP servers.
 * Provides a unified interface to call any registered tool.
 */

import type { McpConnector, McpToolInput, McpToolResult } from "./connector"
import { createStdioConnector } from "./stdio-connector"
import * as mcpToolRepo from "@/lib/repositories/mcp-tool-repo"

// Cache connectors by server name to avoid re-spawning processes
const connectorCache = new Map<string, McpConnector>()

/**
 * Get or create a connector for a given server.
 */
async function getConnector(serverName: string): Promise<McpConnector | null> {
  if (connectorCache.has(serverName)) {
    return connectorCache.get(serverName)!
  }

  const servers = await mcpToolRepo.findAllServers()
  const server = servers.find((s) => s.serverName === serverName && s.enabled)
  if (!server) return null

  let connector: McpConnector

  if (server.transport === "stdio" && server.command) {
    connector = createStdioConnector({
      command: server.command,
      args: server.args,
      timeoutMs: 120_000,
    })
  } else {
    // Unsupported transport type for now
    console.warn(`[mcp-registry] Unsupported transport "${server.transport}" for ${serverName}`)
    return null
  }

  connectorCache.set(serverName, connector)
  return connector
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
 */
function inferCapability(name: string, description: string): string {
  const text = `${name} ${description}`.toLowerCase()

  if (text.includes("dns") || text.includes("subdomain") || text.includes("whois")) return "dns_enum"
  if (text.includes("port") || text.includes("scan") || text.includes("nmap")) return "port_scan"
  if (text.includes("crawl") || text.includes("spider") || text.includes("directory")) return "web_crawl"
  if (text.includes("screenshot") || text.includes("capture")) return "screenshot"
  if (text.includes("sql") || text.includes("inject")) return "vuln_scan"
  if (text.includes("execute") || text.includes("code") || text.includes("script")) return "code_execution"
  if (text.includes("http") || text.includes("request") || text.includes("fetch")) return "http_interaction"
  if (text.includes("graphql")) return "api_discovery"
  if (text.includes("fingerprint") || text.includes("tech") || text.includes("wappalyzer")) return "fingerprint"

  return "general"
}
