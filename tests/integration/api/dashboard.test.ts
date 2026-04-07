/**
 * API 路由测试：dashboard stats + recent logs
 * Mock service/prisma 层，直接调用 route handler
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ─── Mock dashboard service ────────────────────────────
const mockGetDashboardData = vi.fn()
vi.mock("@/lib/services/dashboard-service", () => ({
  getDashboardData: (...args: unknown[]) => mockGetDashboardData(...args),
}))

// ─── Mock prisma for llm-logs/recent ───────────────────
const mockPrisma = {
  llmCallLog: { findMany: vi.fn() },
}
vi.mock("@/lib/infra/prisma", () => ({ prisma: mockPrisma }))

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Dashboard stats ───────────────────────────────────
describe("GET /api/dashboard", () => {
  let GET: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/dashboard/route")
    GET = mod.GET
  })

  it("返回 dashboard 聚合数据 → 200", async () => {
    mockGetDashboardData.mockResolvedValue({
      projectCount: 5,
      activeCount: 2,
      projectStats: [{ lifecycle: "executing", _count: 2 }],
      findingStats: [{ severity: "high", _count: 3 }],
      recentProjects: [],
      recentAudit: [],
    })

    const req = new NextRequest("http://localhost/api/dashboard")
    const res = await GET(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.projectCount).toBe(5)
    expect(body.activeCount).toBe(2)
    expect(body.projectStats).toBeDefined()
    expect(body.findingStats).toBeDefined()
  })

  it("无数据 → 200 + 零值", async () => {
    mockGetDashboardData.mockResolvedValue({
      projectCount: 0,
      activeCount: 0,
      projectStats: [],
      findingStats: [],
      recentProjects: [],
      recentAudit: [],
    })

    const req = new NextRequest("http://localhost/api/dashboard")
    const res = await GET(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.projectCount).toBe(0)
    expect(body.activeCount).toBe(0)
    expect(body.recentProjects).toEqual([])
  })
})

// ─── Recent LLM Logs ──────────────────────────────────
describe("GET /api/llm-logs/recent", () => {
  let GET: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/llm-logs/recent/route")
    GET = mod.GET
  })

  it("返回最近日志列表 → 200", async () => {
    const logs = [
      { id: "log-1", projectId: "proj-1", role: "planner", createdAt: new Date() },
      { id: "log-2", projectId: "proj-1", role: "analyzer", createdAt: new Date() },
    ]
    mockPrisma.llmCallLog.findMany.mockResolvedValue(logs)

    const req = new NextRequest("http://localhost/api/llm-logs/recent")
    const res = await GET(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(2)
    expect(mockPrisma.llmCallLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    )
  })

  it("空日志 → 200 + { items: [] }", async () => {
    mockPrisma.llmCallLog.findMany.mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/llm-logs/recent")
    const res = await GET(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
  })
})
