import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { McpGatewayClient } from "@/components/settings/mcp-gateway-client"
import { mcpBoundaryRules, mcpCapabilityRecords, mcpRegistrationFields, mcpTools } from "@/lib/prototype-data"
import type {
  McpServerContractSummaryRecord,
  McpServerInvocationRecord,
  McpServerRecord,
  McpToolContractSummaryRecord,
} from "@/lib/prototype-types"

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

const serverContractFixtures: McpServerContractSummaryRecord[] = [
  {
    serverId: "mcp-server-web-surface-stdio",
    serverName: "web-surface-stdio",
    version: "1.0.0",
    transport: "stdio",
    enabled: true,
    toolNames: ["web-surface-map"],
    command: "node",
    endpoint: "stdio://web-surface-stdio",
    updatedAt: "2026-03-26 23:59",
  },
]

const toolContractFixtures: McpToolContractSummaryRecord[] = [
  {
    serverId: "mcp-server-web-surface-stdio",
    serverName: "web-surface-stdio",
    toolName: "web-surface-map",
    title: "Web 页面探测",
    capability: "Web 页面探测类",
    boundary: "外部目标交互",
    riskLevel: "中",
    requiresApproval: false,
    resultMappings: ["webEntries", "evidence"],
    updatedAt: "2026-03-26 23:59",
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
        initialServerContracts={serverContractFixtures}
        initialToolContracts={toolContractFixtures}
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
        initialServerContracts={serverContractFixtures}
        initialToolContracts={toolContractFixtures}
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
        initialServerContracts={serverContractFixtures}
        initialToolContracts={toolContractFixtures}
      />,
    )

    expect(screen.getByText("已连接 MCP 服务器")).toBeInTheDocument()
    expect(screen.getAllByText("web-surface-stdio").length).toBeGreaterThan(0)
    expect(screen.getByText("probe_web_surface")).toBeInTheDocument()
  })

  it("submits a validated MCP registration payload from the settings client", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        server: serverFixtures[0],
        serverContract: {
          serverId: serverFixtures[0].id,
          serverName: serverFixtures[0].serverName,
          version: "1.0.0",
          transport: serverFixtures[0].transport,
          enabled: true,
          toolNames: ["web-surface-map"],
          updatedAt: "2026-03-27 11:30",
        },
        toolContracts: [
          {
            serverId: serverFixtures[0].id,
            serverName: serverFixtures[0].serverName,
            toolName: "web-surface-map",
            title: "Web 页面探测",
            capability: "Web 页面探测类",
            boundary: "外部目标交互",
            riskLevel: "中",
            requiresApproval: false,
            resultMappings: ["webEntries", "evidence"],
            updatedAt: "2026-03-27 11:30",
          },
        ],
        toolRecords: [
          {
            ...mcpTools[1],
            toolName: "web-surface-map",
          },
        ],
      }),
    } as Response)

    render(
      <McpGatewayClient
        initialTools={mcpTools}
        initialServers={[]}
        initialInvocations={[]}
        capabilities={mcpCapabilityRecords}
        boundaryRules={mcpBoundaryRules}
        registrationFields={mcpRegistrationFields}
        initialServerContracts={[]}
        initialToolContracts={[]}
      />,
    )

    fireEvent.change(screen.getByRole("textbox", { name: "MCP 注册 JSON" }), {
      target: {
        value: JSON.stringify({
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
              outputSchema: {
                type: "object",
              },
              defaultConcurrency: "1",
              rateLimit: "10 req/min",
              timeout: "15s",
              retry: "1 次",
              owner: "真实 Web recon",
            },
          ],
        }, null, 2),
      },
    })
    fireEvent.click(screen.getByRole("button", { name: "校验并注册 MCP" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/settings/mcp-servers/register",
        expect.objectContaining({
          method: "POST",
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText("MCP server web-surface-stdio 已完成契约校验并注册。")).toBeInTheDocument()
    })
  })
})
