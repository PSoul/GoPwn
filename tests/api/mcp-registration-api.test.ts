import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { POST as registerMcpServer } from "@/app/api/settings/mcp-servers/register/route"
import { GET as getMcpSettings } from "@/app/api/settings/mcp-tools/route"

const validRegistrationPayload = {
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
        additionalProperties: false,
      },
      outputSchema: {
        type: "object",
        properties: {
          webEntries: {
            type: "array",
          },
        },
        additionalProperties: true,
      },
      defaultConcurrency: "1",
      rateLimit: "10 req/min",
      timeout: "15s",
      retry: "1 次",
      owner: "真实 Web recon",
    },
  ],
}

describe("mcp registration api route", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-mcp-registration-store-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
  })

  afterEach(() => {
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("accepts a valid MCP contract registration and mirrors it into runtime tool state", async () => {
    const response = await registerMcpServer(
      new Request("http://localhost/api/settings/mcp-servers/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(validRegistrationPayload),
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.server.serverName).toBe("web-surface-stdio")
    expect(payload.server.toolBindings).toContain("web-surface-map")
    expect(payload.serverContract.toolNames).toContain("web-surface-map")
    expect(payload.toolContracts[0].toolName).toBe("web-surface-map")
    expect(payload.toolRecords[0].toolName).toBe("web-surface-map")

    const settingsResponse = await getMcpSettings()
    const settingsPayload = await settingsResponse.json()

    expect(settingsResponse.status).toBe(200)
    expect(settingsPayload.servers).toHaveLength(1)
    expect(settingsPayload.tools.some((item: { toolName: string }) => item.toolName === "web-surface-map")).toBe(true)
    expect(settingsPayload.serverContracts).toHaveLength(1)
    expect(settingsPayload.toolContracts).toHaveLength(1)
  })

  it("rejects MCP registrations that omit a required input schema", async () => {
    const invalidPayload = {
      ...validRegistrationPayload,
      tools: validRegistrationPayload.tools.map((tool) => {
        const nextTool = { ...tool }
        delete (nextTool as Partial<typeof tool>).inputSchema
        return nextTool
      }),
    }

    const response = await registerMcpServer(
      new Request("http://localhost/api/settings/mcp-servers/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(invalidPayload),
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toContain("inputSchema")
  })

  it("rejects duplicate tool names within the same server registration", async () => {
    const invalidPayload = {
      ...validRegistrationPayload,
      tools: [...validRegistrationPayload.tools, { ...validRegistrationPayload.tools[0] }],
    }

    const response = await registerMcpServer(
      new Request("http://localhost/api/settings/mcp-servers/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(invalidPayload),
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toContain("toolName")
  })

  it("rejects stdio registrations that do not provide a command", async () => {
    const invalidPayload = {
      ...validRegistrationPayload,
      command: "",
    }

    const response = await registerMcpServer(
      new Request("http://localhost/api/settings/mcp-servers/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(invalidPayload),
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toContain("command")
  })
})
