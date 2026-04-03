/**
 * End-to-end pipeline test: auto-discover MCP servers, test tool execution against Docker targets
 */
import { discoverAndRegisterMcpServers, getDiscoveredMcpServerConfig } from "@/lib/mcp/mcp-auto-discovery"
import { listStoredMcpTools } from "@/lib/mcp/mcp-repository"
import { callMcpServerTool } from "@/lib/mcp/mcp-client-service"
import { findStoredEnabledMcpServerByToolBinding } from "@/lib/mcp/mcp-server-repository"
import type { McpServerRecord } from "@/lib/prototype-types"

async function main() {
  console.log("=== Step 1: Auto-discover and register MCP servers ===")
  const discovery = await discoverAndRegisterMcpServers()
  console.log(`Discovered: ${discovery.discovered}, Registered: ${discovery.registered}`)
  console.log(`Servers: ${discovery.servers.join(", ")}`)
  if (discovery.errors.length > 0) {
    console.log(`Errors: ${discovery.errors.join("; ")}`)
  }

  console.log("\n=== Step 2: Verify registered tools ===")
  const tools = await listStoredMcpTools()
  console.log(`Total registered tools: ${tools.length}`)
  const enabledTools = tools.filter(t => t.status === "启用")
  console.log(`Enabled tools: ${enabledTools.length}`)
  for (const tool of enabledTools.slice(0, 5)) {
    console.log(`  - ${tool.toolName} [${tool.capability}] ${tool.riskLevel}`)
  }
  console.log(`  ... and ${Math.max(0, enabledTools.length - 5)} more`)

  console.log("\n=== Step 3: Test env path resolution ===")
  const httpxConfig = getDiscoveredMcpServerConfig("httpx")
  if (httpxConfig) {
    console.log(`httpx CWD: ${httpxConfig.cwd}`)
    console.log(`httpx ENV:`, httpxConfig.env)
  }

  console.log("\n=== Step 4: Test real MCP tool execution (httpx_probe against DVWA) ===")
  const server = await findStoredEnabledMcpServerByToolBinding("httpx_probe")
  if (!server) {
    // Build a synthetic server record from auto-discovery
    const config = getDiscoveredMcpServerConfig("httpx")
    if (!config) {
      console.error("Cannot find httpx server config!")
      process.exit(1)
    }
    const syntheticServer: McpServerRecord = {
      id: "auto-httpx",
      serverName: "httpx-mcp-server",
      transport: "stdio",
      command: config.command,
      args: config.args ?? ["tsx", "src/index.ts"],
      endpoint: "",
      enabled: true,
      status: "已连接",
      toolBindings: [],
      notes: "test",
      lastSeen: new Date().toISOString(),
    }
    console.log("Using synthetic server record (no registered server found)")
    console.log(`CWD: ${config.cwd}`)
    console.log(`ENV: ${JSON.stringify(config.env)}`)

    try {
      const result = await callMcpServerTool({
        server: syntheticServer,
        toolName: "httpx_probe",
        arguments: { targets: ["http://localhost:8081"] },
        target: "http://localhost:8081",
        timeoutMs: 30_000,
        cwd: config.cwd,
        env: config.env,
      })
      console.log("\n=== httpx_probe Result ===")
      console.log("Content:", JSON.stringify(result.content, null, 2))
      console.log("Structured:", JSON.stringify(result.structuredContent, null, 2))
    } catch (e: any) {
      console.error("httpx_probe FAILED:", e.message)
    }
  } else {
    console.log(`Found registered server: ${server.serverName}`)
    const config = getDiscoveredMcpServerConfig("httpx")
    try {
      const result = await callMcpServerTool({
        server,
        toolName: "httpx_probe",
        arguments: { targets: ["http://localhost:8081"] },
        target: "http://localhost:8081",
        timeoutMs: 30_000,
        cwd: config?.cwd,
        env: config?.env,
      })
      console.log("\n=== httpx_probe Result ===")
      console.log("Content:", JSON.stringify(result.content, null, 2))
      console.log("Structured:", JSON.stringify(result.structuredContent, null, 2))
    } catch (e: any) {
      console.error("httpx_probe FAILED:", e.message)
    }
  }

  console.log("\n=== Step 5: Test curl MCP (http_request against DVWA) ===")
  const curlConfig = getDiscoveredMcpServerConfig("curl")
  if (curlConfig) {
    const curlServer: McpServerRecord = {
      id: "auto-curl",
      serverName: "curl-mcp-server",
      transport: "stdio",
      command: curlConfig.command,
      args: curlConfig.args ?? ["tsx", "src/index.ts"],
      endpoint: "",
      enabled: true,
      status: "已连接",
      toolBindings: [],
      notes: "test",
      lastSeen: new Date().toISOString(),
    }
    try {
      const result = await callMcpServerTool({
        server: curlServer,
        toolName: "http_request",
        arguments: { url: "http://localhost:8081", method: "GET" },
        target: "http://localhost:8081",
        timeoutMs: 30_000,
        cwd: curlConfig.cwd,
        env: curlConfig.env,
      })
      console.log("\n=== http_request Result ===")
      const textContent = result.content.filter(c => c.type === "text").map(c => c.text).join("")
      console.log("Response length:", textContent.length)
      console.log("First 500 chars:", textContent.slice(0, 500))
    } catch (e: any) {
      console.error("http_request FAILED:", e.message)
    }
  }

  console.log("\n=== Pipeline test complete ===")
}

main().catch(e => {
  console.error("Fatal:", e.message)
  process.exit(1)
})
