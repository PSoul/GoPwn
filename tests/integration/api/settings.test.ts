/**
 * API 路由测试：settings — llm, approval-policy, system-status, mcp-tools, mcp-servers, mcp-sync
 * Mock service/repo 层，直接调用 route handler
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { routeCtx } from "../../helpers/route-test-utils"

// ─── Mock settings service ─────────────────────────────
const mockGetLlmProfiles = vi.fn()
const mockUpsertLlmProfile = vi.fn()
const mockGetGlobalConfig = vi.fn()
const mockUpdateGlobalConfig = vi.fn()
const mockGetSystemStatus = vi.fn()
vi.mock("@/lib/services/settings-service", () => ({
  getLlmProfiles: (...args: unknown[]) => mockGetLlmProfiles(...args),
  upsertLlmProfile: (...args: unknown[]) => mockUpsertLlmProfile(...args),
  getGlobalConfig: (...args: unknown[]) => mockGetGlobalConfig(...args),
  updateGlobalConfig: (...args: unknown[]) => mockUpdateGlobalConfig(...args),
  getSystemStatus: (...args: unknown[]) => mockGetSystemStatus(...args),
}))

// ─── Mock mcp-tool-repo ────────────────────────────────
const mockFindAllServers = vi.fn()
const mockFindAllTools = vi.fn()
const mockUpsertServer = vi.fn()
vi.mock("@/lib/repositories/mcp-tool-repo", () => ({
  findAllServers: (...args: unknown[]) => mockFindAllServers(...args),
  findAll: (...args: unknown[]) => mockFindAllTools(...args),
  upsertServer: (...args: unknown[]) => mockUpsertServer(...args),
}))

// ─── Mock prisma for mcp-tools/[id] ───────────────────
const mockPrisma = {
  mcpTool: { update: vi.fn() },
}
vi.mock("@/lib/infra/prisma", () => ({ prisma: mockPrisma }))

// ─── Mock mcp-bootstrap for sync ───────────────────────
const mockBootstrapMcp = vi.fn()
vi.mock("@/lib/services/mcp-bootstrap", () => ({
  bootstrapMcp: (...args: unknown[]) => mockBootstrapMcp(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── LLM Profiles ──────────────────────────────────────
describe("GET /api/settings/llm", () => {
  let GET: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/settings/llm/route")
    GET = mod.GET
  })

  it("返回 LLM profiles → 200", async () => {
    const profiles = [
      { id: "planner", provider: "openai", model: "gpt-4" },
      { id: "analyzer", provider: "openai", model: "gpt-4" },
    ]
    mockGetLlmProfiles.mockResolvedValue(profiles)

    const req = new NextRequest("http://localhost/api/settings/llm")
    const res = await GET(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0].id).toBe("planner")
  })
})

describe("PUT /api/settings/llm", () => {
  let PUT: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/settings/llm/route")
    PUT = mod.PUT
  })

  it("更新 LLM profile 成功 → 200", async () => {
    const profile = { id: "planner", provider: "openai", model: "gpt-4o" }
    mockUpsertLlmProfile.mockResolvedValue(profile)
    mockGetLlmProfiles.mockResolvedValue([profile])

    const req = new NextRequest("http://localhost/api/settings/llm", {
      method: "PUT",
      body: JSON.stringify({ id: "planner", model: "gpt-4o" }),
    })
    const res = await PUT(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profile.model).toBe("gpt-4o")
    expect(body.profiles).toHaveLength(1)
    expect(mockUpsertLlmProfile).toHaveBeenCalledWith("planner", { model: "gpt-4o" })
  })
})

// ─── Approval Policy ───────────────────────────────────
describe("GET /api/settings/approval-policy", () => {
  let GET: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/settings/approval-policy/route")
    GET = mod.GET
  })

  it("返回审批策略 → 200", async () => {
    const config = { id: "global", approvalEnabled: true, autoApproveLowRisk: false }
    mockGetGlobalConfig.mockResolvedValue(config)

    const req = new NextRequest("http://localhost/api/settings/approval-policy")
    const res = await GET(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.config.approvalEnabled).toBe(true)
  })
})

describe("PATCH /api/settings/approval-policy", () => {
  let PATCH: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/settings/approval-policy/route")
    PATCH = mod.PATCH
  })

  it("更新审批策略成功 → 200", async () => {
    const config = { id: "global", approvalEnabled: false, autoApproveLowRisk: true }
    mockUpdateGlobalConfig.mockResolvedValue(config)

    const req = new NextRequest("http://localhost/api/settings/approval-policy", {
      method: "PATCH",
      body: JSON.stringify({ approvalEnabled: false, autoApproveLowRisk: true }),
    })
    const res = await PATCH(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.config.approvalEnabled).toBe(false)
  })
})

// ─── System Status ─────────────────────────────────────
describe("GET /api/settings/system-status", () => {
  let GET: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/settings/system-status/route")
    GET = mod.GET
  })

  it("返回系统状态 → 200", async () => {
    mockGetSystemStatus.mockResolvedValue({
      database: "connected",
      tools: 10,
      servers: 3,
      llmProfiles: 2,
    })

    const req = new NextRequest("http://localhost/api/settings/system-status")
    const res = await GET(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.database).toBe("connected")
    expect(body.tools).toBe(10)
    expect(body.servers).toBe(3)
  })
})

// ─── MCP Tools ─────────────────────────────────────────
describe("PATCH /api/settings/mcp-tools/[id]", () => {
  let PATCH: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/settings/mcp-tools/[id]/route")
    PATCH = mod.PATCH
  })

  it("启用/禁用 MCP tool → 200", async () => {
    mockPrisma.mcpTool.update.mockResolvedValue({
      id: "tool-1",
      toolName: "fscan_port_scan",
      enabled: false,
    })

    const req = new NextRequest("http://localhost/api/settings/mcp-tools/tool-1", {
      method: "PATCH",
      body: JSON.stringify({ enabled: false }),
    })
    const res = await PATCH(req, routeCtx({ id: "tool-1" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tool.enabled).toBe(false)
    expect(mockPrisma.mcpTool.update).toHaveBeenCalledWith({
      where: { id: "tool-1" },
      data: { enabled: false },
    })
  })
})

// ─── MCP Servers ───────────────────────────────────────
describe("GET /api/settings/mcp/servers", () => {
  let GET: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/settings/mcp/servers/route")
    GET = mod.GET
  })

  it("返回 MCP servers 列表 → 200", async () => {
    mockFindAllServers.mockResolvedValue([
      { id: "s-1", serverName: "fscan", enabled: true },
    ])
    mockFindAllTools.mockResolvedValue([
      { id: "t-1", toolName: "fscan_port_scan", serverId: "s-1" },
    ])

    const req = new NextRequest("http://localhost/api/settings/mcp/servers")
    const res = await GET(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.servers).toHaveLength(1)
    expect(body.tools).toHaveLength(1)
  })
})

describe("POST /api/settings/mcp/servers", () => {
  let POST: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/settings/mcp/servers/route")
    POST = mod.POST
  })

  it("创建 MCP server → 201", async () => {
    mockUpsertServer.mockResolvedValue({
      id: "s-new",
      serverName: "custom-server",
      transport: "stdio",
      command: "node",
      args: ["server.js"],
    })

    const req = new NextRequest("http://localhost/api/settings/mcp/servers", {
      method: "POST",
      body: JSON.stringify({
        serverName: "custom-server",
        transport: "stdio",
        command: "node",
        args: ["server.js"],
      }),
    })
    const res = await POST(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.serverName).toBe("custom-server")
  })
})

// ─── MCP Sync ──────────────────────────────────────────
describe("POST /api/settings/mcp/sync", () => {
  let POST: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/settings/mcp/sync/route")
    POST = mod.POST
  })

  it("触发 MCP 同步 → 200", async () => {
    mockBootstrapMcp.mockResolvedValue({
      servers: { loaded: 5, errors: [] },
      tools: { synced: 20, errors: [] },
    })

    const req = new NextRequest("http://localhost/api/settings/mcp/sync", { method: "POST" })
    const res = await POST(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.servers.loaded).toBe(5)
    expect(body.tools.synced).toBe(20)
  })
})
