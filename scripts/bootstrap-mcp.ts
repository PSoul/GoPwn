import "dotenv/config"
import { loadServersFromManifest } from "../lib/services/mcp-bootstrap"
import { syncToolsFromServers } from "../lib/mcp/registry"
import * as mcpToolRepo from "../lib/repositories/mcp-tool-repo"

async function main() {
  console.log("=== Loading MCP servers from manifest ===")
  const serverResult = await loadServersFromManifest()
  console.log(`Loaded ${serverResult.loaded} servers`)
  if (serverResult.errors.length > 0) {
    console.warn("Errors:", serverResult.errors)
  }

  // Show what we loaded
  const servers = await mcpToolRepo.findAllServers()
  for (const s of servers) {
    console.log(`  ${s.serverName}: ${s.command} ${s.args.join(" ")} [cwd: ${s.cwd ?? "n/a"}]`)
  }

  console.log("\n=== Discovering tools from servers ===")
  const toolResult = await syncToolsFromServers()
  console.log(`Synced ${toolResult.synced} tools`)
  if (toolResult.errors.length > 0) {
    console.warn("Errors:", toolResult.errors)
  }

  const tools = await mcpToolRepo.findEnabled()
  for (const t of tools) {
    console.log(`  [${t.serverName}] ${t.toolName} — ${t.capability}: ${t.description.slice(0, 80)}`)
  }

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
