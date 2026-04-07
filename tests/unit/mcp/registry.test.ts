import { vi, describe, it, expect, beforeEach, type Mock } from "vitest"

const mockConnector = {
  callTool: vi.fn().mockResolvedValue({ content: "ok", isError: false, durationMs: 10 }),
  listTools: vi.fn().mockResolvedValue([]),
  close: vi.fn().mockResolvedValue(undefined),
}

vi.mock("@/lib/mcp/stdio-connector", () => ({
  createStdioConnector: vi.fn(() => mockConnector),
}))

vi.mock("@/lib/repositories/mcp-tool-repo", () => ({
  findAllServers: vi.fn(),
  findByToolName: vi.fn(),
  upsert: vi.fn(),
}))

import { callTool, closeAll, syncToolsFromServers } from "@/lib/mcp/registry"
import { createStdioConnector } from "@/lib/mcp/stdio-connector"
import * as mcpToolRepo from "@/lib/repositories/mcp-tool-repo"

const mockFindAllServers = mcpToolRepo.findAllServers as Mock
const mockFindByToolName = mcpToolRepo.findByToolName as Mock
const mockUpsert = mcpToolRepo.upsert as Mock
const mockCreateStdioConnector = createStdioConnector as Mock

function makeServer(overrides: Record<string, unknown> = {}) {
  return {
    serverName: "script",
    transport: "stdio",
    command: "node",
    args: ["server.js"],
    cwd: null,
    envJson: null,
    endpoint: null,
    enabled: true,
    ...overrides,
  }
}

describe("mcp/registry", () => {
  beforeEach(async () => {
    // 清理模块级缓存
    await closeAll()
    vi.clearAllMocks()
    // 重新设置 mockConnector 的默认行为
    mockConnector.callTool.mockResolvedValue({ content: "ok", isError: false, durationMs: 10 })
    mockConnector.listTools.mockResolvedValue([])
    mockConnector.close.mockResolvedValue(undefined)
  })

  it("首次 callTool 触发 createStdioConnector", async () => {
    mockFindByToolName.mockResolvedValue({ toolName: "scan", serverName: "script", enabled: true })
    mockFindAllServers.mockResolvedValue([makeServer()])

    await callTool("scan", { target: "127.0.0.1" })

    expect(mockCreateStdioConnector).toHaveBeenCalledTimes(1)
    expect(mockConnector.callTool).toHaveBeenCalledWith("scan", { target: "127.0.0.1" })
  })

  it("重复调用命中缓存 — createStdioConnector 仍只调用 1 次", async () => {
    mockFindByToolName.mockResolvedValue({ toolName: "scan", serverName: "script", enabled: true })
    mockFindAllServers.mockResolvedValue([makeServer()])

    await callTool("scan", {})
    await callTool("scan", {})

    expect(mockCreateStdioConnector).toHaveBeenCalledTimes(1)
  })

  it("并发 callTool 去重 — 只 spawn 一次", async () => {
    mockFindByToolName.mockResolvedValue({ toolName: "scan", serverName: "script", enabled: true })
    mockFindAllServers.mockResolvedValue([makeServer()])

    await Promise.all([
      callTool("scan", { a: 1 }),
      callTool("scan", { a: 2 }),
    ])

    expect(mockCreateStdioConnector).toHaveBeenCalledTimes(1)
  })

  it("server 禁用 → 缓存淘汰 + connector.close", async () => {
    mockFindByToolName.mockResolvedValue({ toolName: "scan", serverName: "script", enabled: true })
    // 第一次调用：server 启用
    mockFindAllServers.mockResolvedValue([makeServer()])
    await callTool("scan", {})

    // 第二次调用：server 已禁用
    mockFindAllServers.mockResolvedValue([makeServer({ enabled: false })])
    const result = await callTool("scan", {})

    expect(result.isError).toBe(true)
    expect(result.content).toContain("not available")
    expect(mockConnector.close).toHaveBeenCalled()
  })

  it("callTool 路由正确 — findByToolName 返回 serverName", async () => {
    mockFindByToolName.mockResolvedValue({ toolName: "http_request", serverName: "script", enabled: true })
    mockFindAllServers.mockResolvedValue([makeServer()])

    const result = await callTool("http_request", { url: "http://example.com" })

    expect(result.content).toBe("ok")
    expect(result.isError).toBe(false)
    expect(mockConnector.callTool).toHaveBeenCalledWith("http_request", { url: "http://example.com" })
  })

  it("callTool 工具不存在 → isError + not found", async () => {
    mockFindByToolName.mockResolvedValue(null)

    const result = await callTool("nonexistent", {})

    expect(result.isError).toBe(true)
    expect(result.content).toContain("not found")
  })

  it("closeAll 清理所有 connector", async () => {
    mockFindByToolName.mockResolvedValue({ toolName: "scan", serverName: "script", enabled: true })
    mockFindAllServers.mockResolvedValue([makeServer()])

    await callTool("scan", {})
    mockConnector.close.mockClear()

    await closeAll()

    expect(mockConnector.close).toHaveBeenCalled()
  })
})
