/**
 * API 路由测试：orchestrator, events, report-export, rounds/steps
 * Mock repo/service 层，直接调用 route handler
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { routeCtx } from "../../helpers/route-test-utils"
import { mockProject } from "../../helpers/factories"

// ─── Mock prisma（orchestrator + steps 路由直接用 prisma）────
const mockPrisma = {
  orchestratorPlan: { findMany: vi.fn() },
  orchestratorRound: { findMany: vi.fn(), findUnique: vi.fn() },
  project: { findUnique: vi.fn() },
  mcpRun: { findMany: vi.fn() },
  asset: { count: vi.fn() },
  finding: { count: vi.fn() },
}
vi.mock("@/lib/infra/prisma", () => ({ prisma: mockPrisma }))

// Mock pg-listener for events route
const mockListener = { close: vi.fn().mockResolvedValue(undefined) }
vi.mock("@/lib/infra/pg-listener", () => ({
  createPgListener: vi.fn().mockResolvedValue(mockListener),
}))

// Mock project-service for report-export
const mockGetProject = vi.fn()
vi.mock("@/lib/services/project-service", () => ({
  getProject: (...args: unknown[]) => mockGetProject(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Orchestrator ──────────────────────────────────────
describe("GET /api/projects/[projectId]/orchestrator", () => {
  let GET: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/projects/[projectId]/orchestrator/route")
    GET = mod.GET
  })

  it("返回 orchestrator 状态 → 200", async () => {
    mockPrisma.orchestratorPlan.findMany.mockResolvedValue([
      { id: "plan-1", projectId: "proj-1", round: 1 },
    ])
    mockPrisma.orchestratorRound.findMany.mockResolvedValue([
      { id: "round-1", projectId: "proj-1", round: 1, status: "completed" },
    ])

    const req = new NextRequest("http://localhost/api/projects/proj-1/orchestrator")
    const res = await GET(req, routeCtx({ projectId: "proj-1" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.plans).toHaveLength(1)
    expect(body.rounds).toHaveLength(1)
  })
})

// ─── Events SSE ────────────────────────────────────────
describe("GET /api/projects/[projectId]/events", () => {
  let GET: (req: Request, ctx: { params: Promise<{ projectId: string }> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/projects/[projectId]/events/route")
    GET = mod.GET
  })

  it("返回 SSE stream → text/event-stream content-type", async () => {
    const controller = new AbortController()
    const req = new Request("http://localhost/api/projects/proj-1/events", {
      signal: controller.signal,
    })

    const res = await GET(req, { params: Promise.resolve({ projectId: "proj-1" }) })

    expect(res.headers.get("Content-Type")).toBe("text/event-stream")
    expect(res.headers.get("Cache-Control")).toBe("no-cache, no-transform")
    expect(res.body).toBeInstanceOf(ReadableStream)

    // Cleanup: abort to close the stream
    controller.abort()
  })
})

// ─── Report Export ─────────────────────────────────────
describe("POST /api/projects/[projectId]/report-export", () => {
  let POST: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/projects/[projectId]/report-export/route")
    POST = mod.POST
  })

  it("导出报告 → 200 + JSON 格式", async () => {
    mockGetProject.mockResolvedValue(mockProject({ name: "Test Report Project" }))
    mockPrisma.asset.count.mockResolvedValue(5)
    mockPrisma.finding.count.mockResolvedValue(3)

    const req = new NextRequest("http://localhost/api/projects/proj-1/report-export", {
      method: "POST",
    })
    const res = await POST(req, routeCtx({ projectId: "proj-1" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.export).toBeDefined()
    expect(body.export.assetCount).toBe(5)
    expect(body.export.findingCount).toBe(3)
    expect(body.export.summary).toContain("Test Report Project")
  })

  it("项目不存在 → 404", async () => {
    const { NotFoundError } = await import("@/lib/domain/errors")
    mockGetProject.mockRejectedValue(new NotFoundError("Project", "nonexistent"))

    const req = new NextRequest("http://localhost/api/projects/nonexistent/report-export", {
      method: "POST",
    })
    const res = await POST(req, routeCtx({ projectId: "nonexistent" }))

    expect(res.status).toBe(404)
  })
})

// ─── Rounds / Steps ────────────────────────────────────
describe("GET /api/projects/[projectId]/rounds/[round]/steps", () => {
  let GET: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/projects/[projectId]/rounds/[round]/steps/route")
    GET = mod.GET
  })

  it("返回 round steps → 200", async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ id: "proj-1" })
    mockPrisma.mcpRun.findMany.mockResolvedValue([
      { id: "step-1", stepIndex: 0, toolName: "fscan_port_scan", round: 1 },
      { id: "step-2", stepIndex: 1, toolName: "curl_http_request", round: 1 },
    ])
    mockPrisma.orchestratorRound.findUnique.mockResolvedValue({
      phase: "recon",
      status: "completed",
      maxSteps: 5,
      actualSteps: 2,
      stopReason: null,
      newAssetCount: 1,
      newFindingCount: 0,
      startedAt: new Date(),
      completedAt: new Date(),
    })

    const req = new NextRequest("http://localhost/api/projects/proj-1/rounds/1/steps")
    const res = await GET(req, routeCtx({ projectId: "proj-1", round: "1" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.round).toBe(1)
    expect(body.steps).toHaveLength(2)
    expect(body.meta).toBeDefined()
    expect(body.meta.phase).toBe("recon")
  })

  it("空 steps → 200 + steps: []", async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ id: "proj-1" })
    mockPrisma.mcpRun.findMany.mockResolvedValue([])
    mockPrisma.orchestratorRound.findUnique.mockResolvedValue(null)

    const req = new NextRequest("http://localhost/api/projects/proj-1/rounds/1/steps")
    const res = await GET(req, routeCtx({ projectId: "proj-1", round: "1" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.steps).toEqual([])
    expect(body.meta).toBeNull()
  })

  it("round 不存在（项目存在但无 meta） → 200 + meta: null", async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ id: "proj-1" })
    mockPrisma.mcpRun.findMany.mockResolvedValue([])
    mockPrisma.orchestratorRound.findUnique.mockResolvedValue(null)

    const req = new NextRequest("http://localhost/api/projects/proj-1/rounds/99/steps")
    const res = await GET(req, routeCtx({ projectId: "proj-1", round: "99" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.round).toBe(99)
    expect(body.meta).toBeNull()
  })

  it("无效 round number → 400", async () => {
    const req = new NextRequest("http://localhost/api/projects/proj-1/rounds/abc/steps")
    const res = await GET(req, routeCtx({ projectId: "proj-1", round: "abc" }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("Invalid round")
  })
})
