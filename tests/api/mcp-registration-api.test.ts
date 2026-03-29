import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { POST as registerMcpServer } from "@/app/api/settings/mcp-servers/register/route"
import { GET as getMcpSettings } from "@/app/api/settings/mcp-tools/route"

const validRegistrationPayload = {
  serverName: "external-intel-stdio",
  version: "1.0.0",
  transport: "stdio",
  command: "node",
  args: ["scripts/mcp/external-intel-server.mjs"],
  endpoint: "stdio://external-intel-stdio",
  enabled: true,
  notes: "真实外部情报查询 MCP server",
  tools: [
    {
      toolName: "external-intel-query",
      title: "外部情报查询",
      description: "查询第三方外部情报平台并回传结构化结果。",
      version: "1.0.0",
      capability: "外部情报查询类",
      boundary: "外部第三方API",
      riskLevel: "低",
      requiresApproval: false,
      resultMappings: ["intelligence"],
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
      outputSchema: {
        type: "object",
        properties: {
          structuredResults: {
            type: "array",
          },
          totalCount: {
            type: "integer",
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
    expect(payload.server.serverName).toBe("external-intel-stdio")
    expect(payload.server.toolBindings).toContain("external-intel-query")
    expect(payload.serverContract.toolNames).toContain("external-intel-query")
    expect(payload.toolContracts[0].toolName).toBe("external-intel-query")
    expect(payload.toolContracts[0].boundary).toBe("外部第三方API")
    expect(payload.toolContracts[0].resultMappings).toEqual(["intelligence"])
    expect(payload.toolRecords[0].toolName).toBe("external-intel-query")

    const settingsResponse = await getMcpSettings()
    const settingsPayload = await settingsResponse.json()

    expect(settingsResponse.status).toBe(200)
    expect(settingsPayload.servers).toHaveLength(1)
    expect(settingsPayload.tools.some((item: { toolName: string }) => item.toolName === "external-intel-query")).toBe(true)
    expect(settingsPayload.serverContracts).toHaveLength(1)
    expect(settingsPayload.toolContracts).toHaveLength(1)
  })

  it("accepts stdio registrations that omit optional endpoint and notes fields", async () => {
    const response = await registerMcpServer(
      new Request("http://localhost/api/settings/mcp-servers/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...validRegistrationPayload,
          endpoint: undefined,
          notes: undefined,
        }),
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.server.endpoint).toBe("")
    expect(payload.server.notes).toBe("")
    expect(payload.serverContract.endpoint).toBe("")
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

  it("rejects MCP registrations that omit a required output schema", async () => {
    const invalidPayload = {
      ...validRegistrationPayload,
      tools: validRegistrationPayload.tools.map((tool) => {
        const nextTool = { ...tool }
        delete (nextTool as Partial<typeof tool>).outputSchema
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
    expect(payload.error).toContain("outputSchema")
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
