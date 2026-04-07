/**
 * API 路由测试：projects findings + evidence
 * Mock repo 层，直接调用 route handler
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"
import { NextRequest } from "next/server"
import { routeCtx } from "../../helpers/route-test-utils"
import { mockFinding, mockEvidence } from "../../helpers/factories"

// ─── Mock repos ────────────────────────────────────────
const mockFindByProject = vi.fn()
const mockFindById = vi.fn()
vi.mock("@/lib/repositories/finding-repo", () => ({
  findByProject: (...args: unknown[]) => mockFindByProject(...args),
  findById: (...args: unknown[]) => mockFindById(...args),
}))

const mockEvidenceFindByProject = vi.fn()
vi.mock("@/lib/repositories/evidence-repo", () => ({
  findByProject: (...args: unknown[]) => mockEvidenceFindByProject(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Findings route ────────────────────────────────────
describe("GET /api/projects/[projectId]/findings", () => {
  let GET: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/projects/[projectId]/findings/route")
    GET = mod.GET
  })

  it("返回 findings 列表 → 200", async () => {
    const findings = [mockFinding(), mockFinding({ id: "finding-002", title: "XSS" })]
    mockFindByProject.mockResolvedValue(findings)

    const req = new NextRequest("http://localhost/api/projects/proj-1/findings")
    const res = await GET(req, routeCtx({ projectId: "proj-1" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0].title).toBe("SQL Injection")
    expect(mockFindByProject).toHaveBeenCalledWith("proj-1")
  })

  it("空列表 → 200 + []", async () => {
    mockFindByProject.mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/projects/proj-1/findings")
    const res = await GET(req, routeCtx({ projectId: "proj-1" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it("项目不存在 → 返回空数组（repo 层不检查项目存在性）", async () => {
    mockFindByProject.mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/projects/nonexistent/findings")
    const res = await GET(req, routeCtx({ projectId: "nonexistent" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it("返回的 finding 包含 severity 字段", async () => {
    const findings = [
      mockFinding({ severity: "critical" }),
      mockFinding({ id: "finding-002", severity: "low" }),
    ]
    mockFindByProject.mockResolvedValue(findings)

    const req = new NextRequest("http://localhost/api/projects/proj-1/findings")
    const res = await GET(req, routeCtx({ projectId: "proj-1" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].severity).toBe("critical")
    expect(body[1].severity).toBe("low")
  })
})

// ─── Evidence route ────────────────────────────────────
describe("GET /api/projects/[projectId]/evidence", () => {
  let GET: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/projects/[projectId]/evidence/route")
    GET = mod.GET
  })

  it("返回 evidence 列表 → 200", async () => {
    const evidence = [mockEvidence(), mockEvidence({ id: "evidence-002" })]
    mockEvidenceFindByProject.mockResolvedValue(evidence)

    const req = new NextRequest("http://localhost/api/projects/proj-1/evidence")
    const res = await GET(req, routeCtx({ projectId: "proj-1" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0].toolName).toBe("fscan_port_scan")
  })

  it("evidence 包含关联数据", async () => {
    const evidence = [
      mockEvidence({
        rawOutput: "HTTP/1.1 200 OK\nerror in SQL syntax",
        toolName: "curl_http_request",
      }),
    ]
    mockEvidenceFindByProject.mockResolvedValue(evidence)

    const req = new NextRequest("http://localhost/api/projects/proj-1/evidence")
    const res = await GET(req, routeCtx({ projectId: "proj-1" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].rawOutput).toContain("SQL syntax")
    expect(body[0].toolName).toBe("curl_http_request")
  })
})
