import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GET as getMcpSettings } from "@/app/api/settings/mcp-tools/route"
import { GET as getMcpTool, PATCH as patchMcpTool } from "@/app/api/settings/mcp-tools/[toolId]/route"
import { POST as postHealthCheck } from "@/app/api/settings/mcp-tools/[toolId]/health-check/route"
import { GET as getSystemStatus } from "@/app/api/settings/system-status/route"

const buildToolContext = (toolId: string) => ({
  params: Promise.resolve({ toolId }),
})

describe("mcp tools api routes", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-mcp-store-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
  })

  afterEach(() => {
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("returns MCP settings payload with tools and capability contracts", async () => {
    const response = await getMcpSettings()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.tools.length).toBeGreaterThan(0)
    expect(payload.servers.length).toBeGreaterThan(0)
    expect(payload.servers.some((item: { serverName: string }) => item.serverName === "web-surface-stdio")).toBe(true)
    expect(payload.capabilities.some((item: { name: string }) => item.name === "受控验证类")).toBe(true)
    expect(payload.registrationFields.some((item: { label: string }) => item.label === "工具名称")).toBe(true)
  })

  it("persists MCP tool configuration updates", async () => {
    const response = await patchMcpTool(
      new Request("http://localhost/api/settings/mcp-tools/mcp-06", {
        method: "PATCH",
        body: JSON.stringify({
          status: "启用",
          defaultConcurrency: "3",
          rateLimit: "30 req/min",
          timeout: "50s",
          retry: "1 次",
          notes: "端口探测范围策略已补齐，可恢复进入候选池。",
        }),
        headers: { "content-type": "application/json" },
      }),
      buildToolContext("mcp-06"),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.tool.status).toBe("启用")
    expect(payload.tool.defaultConcurrency).toBe("3")

    const detailResponse = await getMcpTool(new Request("http://localhost/api/settings/mcp-tools/mcp-06"), buildToolContext("mcp-06"))
    const detailPayload = await detailResponse.json()

    expect(detailResponse.status).toBe(200)
    expect(detailPayload.tool.notes).toContain("范围策略已补齐")
  })

  it("runs health checks and updates system status", async () => {
    const response = await postHealthCheck(
      new Request("http://localhost/api/settings/mcp-tools/mcp-03/health-check", { method: "POST" }),
      buildToolContext("mcp-03"),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.tool.status).toBe("启用")

    const systemStatusResponse = await getSystemStatus()
    const systemStatusPayload = await systemStatusResponse.json()

    expect(systemStatusResponse.status).toBe(200)
    expect(systemStatusPayload.items.find((item: { title: string }) => item.title === "MCP 网关").value).toContain("/")
  })
})
