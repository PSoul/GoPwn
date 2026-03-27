import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  appendStoredMcpServerInvocation,
  getStoredMcpServerById,
  listStoredMcpServerInvocations,
  listStoredMcpServers,
  registerStoredMcpServer,
} from "@/lib/mcp-server-repository"

describe("MCP server repository", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-mcp-server-store-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
  })

  afterEach(() => {
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("starts with an empty MCP server registry until a real server is registered", () => {
    const servers = listStoredMcpServers()

    expect(servers).toHaveLength(0)
    expect(getStoredMcpServerById("mcp-server-web-surface-stdio")).toBeNull()
  })

  it("persists invocation logs for external MCP server calls", () => {
    registerStoredMcpServer({
      serverName: "web-surface-stdio",
      version: "1.0.0",
      transport: "stdio",
      command: "node",
      args: ["scripts/mcp/web-surface-server.mjs"],
      endpoint: "stdio://web-surface-stdio",
      enabled: true,
      notes: "真实 Web 页面探测 MCP server",
      tools: [
        {
          toolName: "web-surface-map",
          title: "Web 页面探测",
          description: "补采页面入口与响应特征。",
          version: "1.0.0",
          capability: "Web 页面探测类",
          boundary: "外部目标交互",
          riskLevel: "中",
          requiresApproval: false,
          resultMappings: ["webEntries", "evidence"],
          inputSchema: {
            type: "object",
            properties: {
              targetUrl: {
                type: "string",
              },
            },
            required: ["targetUrl"],
          },
          defaultConcurrency: "1",
          rateLimit: "10 req/min",
          timeout: "15s",
          retry: "1 次",
          owner: "测试夹具",
        },
      ],
    })

    appendStoredMcpServerInvocation({
      serverId: "mcp-server-web-surface-stdio",
      toolName: "probe_web_surface",
      status: "succeeded",
      target: "http://127.0.0.1:3000/login",
      summary: "页面入口探测完成",
      durationMs: 182,
    })

    const logs = listStoredMcpServerInvocations("mcp-server-web-surface-stdio")

    expect(logs).toHaveLength(1)
    expect(logs[0].toolName).toBe("probe_web_surface")
    expect(logs[0].status).toBe("succeeded")
    expect(logs[0].summary).toContain("探测完成")
  })
})
