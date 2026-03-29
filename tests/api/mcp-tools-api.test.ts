import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GET as getMcpSettings } from "@/app/api/settings/mcp-tools/route"
import { GET as getMcpTool, PATCH as patchMcpTool } from "@/app/api/settings/mcp-tools/[toolId]/route"
import { POST as postHealthCheck } from "@/app/api/settings/mcp-tools/[toolId]/health-check/route"
import { GET as getSystemStatus } from "@/app/api/settings/system-status/route"
import {
  seedWorkflowReadyMcpTools,
  workflowReadyMcpToolFixtures,
} from "@/tests/helpers/project-fixtures"

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

  it("returns MCP settings payload without phantom servers when nothing has been registered", async () => {
    seedWorkflowReadyMcpTools()
    const response = await getMcpSettings()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.tools.length).toBeGreaterThan(0)
    expect(payload.servers).toHaveLength(0)
    expect(payload.capabilities.some((item: { name: string }) => item.name === "受控验证类")).toBe(true)
    expect(payload.capabilities.some((item: { name: string }) => item.name === "外部情报查询类")).toBe(true)
    expect(payload.boundaryRules.some((item: { type: string }) => item.type === "外部第三方API")).toBe(true)
    expect(payload.registrationFields.some((item: { label: string }) => item.label === "工具名称")).toBe(true)
  })

  it("persists MCP tool configuration updates", async () => {
    seedWorkflowReadyMcpTools()
    const toolId = workflowReadyMcpToolFixtures.find((tool) => tool.toolName === "dns-census")?.id ?? "tool-dns-census"
    const response = await patchMcpTool(
      new Request(`http://localhost/api/settings/mcp-tools/${toolId}`, {
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
      buildToolContext(toolId),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.tool.status).toBe("启用")
    expect(payload.tool.defaultConcurrency).toBe("3")

    const detailResponse = await getMcpTool(
      new Request(`http://localhost/api/settings/mcp-tools/${toolId}`),
      buildToolContext(toolId),
    )
    const detailPayload = await detailResponse.json()

    expect(detailResponse.status).toBe(200)
    expect(detailPayload.tool.notes).toContain("范围策略已补齐")
  })

  it("runs health checks and updates system status", async () => {
    const unhealthyTools = workflowReadyMcpToolFixtures.map((tool) =>
      tool.toolName === "web-surface-map"
        ? {
            ...tool,
            status: "异常" as const,
            notes: "最近一次巡检失败，等待健康检查恢复。",
          }
        : tool,
    )
    seedWorkflowReadyMcpTools(unhealthyTools)
    const toolId = unhealthyTools.find((tool) => tool.toolName === "web-surface-map")?.id ?? "tool-web-surface-map"
    const response = await postHealthCheck(
      new Request(`http://localhost/api/settings/mcp-tools/${toolId}/health-check`, { method: "POST" }),
      buildToolContext(toolId),
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
