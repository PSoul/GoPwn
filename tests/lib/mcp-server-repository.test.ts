import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  appendStoredMcpServerInvocation,
  getStoredMcpServerById,
  listStoredMcpServerInvocations,
  listStoredMcpServers,
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

  it("seeds the real web-surface MCP server registry in SQLite", () => {
    const servers = listStoredMcpServers()
    const webSurfaceServer = getStoredMcpServerById("mcp-server-web-surface-stdio")

    expect(servers.length).toBeGreaterThan(0)
    expect(webSurfaceServer?.serverName).toBe("web-surface-stdio")
    expect(webSurfaceServer?.transport).toBe("stdio")
    expect(webSurfaceServer?.toolBindings).toContain("web-surface-map")
    expect(webSurfaceServer?.command).toContain("node")
  })

  it("persists invocation logs for external MCP server calls", () => {
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
