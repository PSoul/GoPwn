/**
 * MCP bootstrap — loads MCP servers from mcps/mcp-servers.json into the database,
 * then discovers tools from each server via stdio.
 */

import { readFileSync, existsSync } from "fs"
import { resolve } from "path"
import * as mcpToolRepo from "@/lib/repositories/mcp-tool-repo"
import { syncToolsFromServers } from "@/lib/mcp/registry"

type McpServerManifest = {
  mcpServers: Record<string, {
    command: string
    args: string[]
    cwd?: string
    env?: Record<string, string>
  }>
}

/**
 * Load all MCP servers from the manifest file into the database.
 * Idempotent — safe to call multiple times.
 */
export async function loadServersFromManifest(): Promise<{ loaded: number; errors: string[] }> {
  const manifestPath = resolve(process.cwd(), "mcps/mcp-servers.json")
  let manifest: McpServerManifest

  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as McpServerManifest
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { loaded: 0, errors: [`Failed to read manifest: ${msg}`] }
  }

  let loaded = 0
  const errors: string[] = []

  for (const [serverName, config] of Object.entries(manifest.mcpServers)) {
    try {
      // Resolve cwd relative to project root
      const cwd = config.cwd
        ? resolve(process.cwd(), config.cwd)
        : undefined

      // 解析 env 中的路径值：如果值指向一个存在的文件，转为绝对路径
      const resolvedEnv = config.env ? resolveEnvPaths(config.env) : undefined

      await mcpToolRepo.upsertServer({
        serverName,
        transport: "stdio",
        command: config.command,
        args: config.args,
        cwd,
        envJson: resolvedEnv ? JSON.stringify(resolvedEnv) : undefined,
      })
      loaded++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${serverName}: ${msg}`)
    }
  }

  return { loaded, errors }
}

/**
 * Full bootstrap: load servers from manifest, then discover tools.
 */
export async function bootstrapMcp(): Promise<{
  servers: { loaded: number; errors: string[] }
  tools: { synced: number; errors: string[] }
}> {
  console.log("[mcp-bootstrap] Loading servers from manifest...")
  const servers = await loadServersFromManifest()
  console.log(`[mcp-bootstrap] Loaded ${servers.loaded} servers, ${servers.errors.length} errors`)

  if (servers.errors.length > 0) {
    console.warn("[mcp-bootstrap] Server errors:", servers.errors)
  }

  console.log("[mcp-bootstrap] Discovering tools from servers...")
  const tools = await syncToolsFromServers()
  console.log(`[mcp-bootstrap] Synced ${tools.synced} tools, ${tools.errors.length} errors`)

  if (tools.errors.length > 0) {
    console.warn("[mcp-bootstrap] Tool discovery errors:", tools.errors)
  }

  return { servers, tools }
}

/**
 * 解析 env 中的路径：以 _PATH 结尾的变量，如果其值指向一个存在的文件，转为绝对路径。
 * 解决子进程 cwd 与项目根目录不同导致相对路径找不到二进制的问题。
 */
function resolveEnvPaths(env: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (key.endsWith("_PATH") && value && !value.startsWith("/") && !(/^[A-Z]:\\/i.test(value))) {
      // 相对路径 → 尝试从项目根解析
      const abs = resolve(process.cwd(), value)
      if (existsSync(abs)) {
        resolved[key] = abs
        continue
      }
    }
    resolved[key] = value
  }
  return resolved
}
