import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { McpGatewayClient } from "@/components/settings/mcp-gateway-client"
import { mcpBoundaryRules, mcpCapabilityRecords, mcpRegistrationFields, mcpTools } from "@/lib/prototype-data"
import type { McpServerInvocationRecord, McpServerRecord } from "@/lib/prototype-types"

const serverFixtures: McpServerRecord[] = [
  {
    id: "mcp-server-web-surface-stdio",
    serverName: "web-surface-stdio",
    transport: "stdio",
    command: "node",
    args: ["scripts/mcp/web-surface-server.mjs"],
    endpoint: "stdio://web-surface-stdio",
    enabled: true,
    status: "已连接",
    toolBindings: ["web-surface-map"],
    notes: "真实 Web 页面探测 MCP server",
    lastSeen: "2026-03-26 23:59",
  },
]

const invocationFixtures: McpServerInvocationRecord[] = [
  {
    id: "mcp-invoke-001",
    serverId: "mcp-server-web-surface-stdio",
    toolName: "probe_web_surface",
    status: "succeeded",
    target: "http://127.0.0.1:3000/login",
    summary: "页面入口探测完成",
    durationMs: 120,
    createdAt: "2026-03-26 23:59",
  },
]

describe("McpGatewayClient", () => {
  beforeEach(() => {
    global.fetch = vi.fn() as unknown as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("persists MCP tool configuration changes", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tool: {
          ...mcpTools[0],
          status: "禁用",
          notes: "测试备注",
        },
      }),
    } as Response)

    render(
      <McpGatewayClient
        initialTools={mcpTools}
        initialServers={serverFixtures}
        initialInvocations={invocationFixtures}
        capabilities={mcpCapabilityRecords}
        boundaryRules={mcpBoundaryRules}
        registrationFields={mcpRegistrationFields}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "禁用" }))
    fireEvent.change(screen.getByRole("textbox", { name: "MCP 工具备注" }), {
      target: { value: "测试备注" },
    })
    fireEvent.click(screen.getByRole("button", { name: "保存工具配置" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/settings/mcp-tools/${mcpTools[0].id}`,
        expect.objectContaining({
          method: "PATCH",
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText(`MCP 工具 ${mcpTools[0].toolName} 已保存。`)).toBeInTheDocument()
    })
  })

  it("runs MCP health checks from the settings client", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tool: {
          ...mcpTools[2],
          status: "启用",
        },
      }),
    } as Response)

    render(
      <McpGatewayClient
        initialTools={mcpTools}
        initialServers={serverFixtures}
        initialInvocations={invocationFixtures}
        capabilities={mcpCapabilityRecords}
        boundaryRules={mcpBoundaryRules}
        registrationFields={mcpRegistrationFields}
      />,
    )

    const portScoutRow = screen
      .getAllByRole("row")
      .find((row) => within(row).queryByText(mcpTools[2].toolName))

    expect(portScoutRow).not.toBeNull()

    fireEvent.click(within(portScoutRow as HTMLElement).getByRole("button", { name: "查看详情" }))

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: mcpTools[2].toolName })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "执行健康巡检" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(`/api/settings/mcp-tools/${mcpTools[2].id}/health-check`, expect.objectContaining({ method: "POST" }))
    })
  })

  it("renders the connected MCP server registry", () => {
    render(
      <McpGatewayClient
        initialTools={mcpTools}
        initialServers={serverFixtures}
        initialInvocations={invocationFixtures}
        capabilities={mcpCapabilityRecords}
        boundaryRules={mcpBoundaryRules}
        registrationFields={mcpRegistrationFields}
      />,
    )

    expect(screen.getByText("已连接 MCP 服务器")).toBeInTheDocument()
    expect(screen.getByText("web-surface-stdio")).toBeInTheDocument()
    expect(screen.getByText("probe_web_surface")).toBeInTheDocument()
  })
})
