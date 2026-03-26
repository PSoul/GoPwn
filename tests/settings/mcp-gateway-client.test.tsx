import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { McpGatewayClient } from "@/components/settings/mcp-gateway-client"
import { mcpBoundaryRules, mcpCapabilityRecords, mcpRegistrationFields, mcpTools } from "@/lib/prototype-data"

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
})
