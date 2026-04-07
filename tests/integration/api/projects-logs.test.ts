/**
 * API 路由测试：llm-logs, mcp-runs, pipeline-logs
 * Mock repo 层，直接调用 route handler
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { routeCtx } from "../../helpers/route-test-utils"
import { mockLlmLog, mockMcpRun } from "../../helpers/factories"

// ─── Mock repos ────────────────────────────────────────
const mockLlmLogFindByProject = vi.fn()
vi.mock("@/lib/repositories/llm-log-repo", () => ({
  findByProject: (...args: unknown[]) => mockLlmLogFindByProject(...args),
}))

const mockMcpRunFindByProject = vi.fn()
vi.mock("@/lib/repositories/mcp-run-repo", () => ({
  findByProject: (...args: unknown[]) => mockMcpRunFindByProject(...args),
  create: vi.fn(),
  updateStatus: vi.fn(),
}))

const mockPipelineLogFindByProject = vi.fn()
const mockPipelineLogCountByProject = vi.fn()
vi.mock("@/lib/repositories/pipeline-log-repo", () => ({
  findByProject: (...args: unknown[]) => mockPipelineLogFindByProject(...args),
  countByProject: (...args: unknown[]) => mockPipelineLogCountByProject(...args),
}))

// Mock dependencies that mcp-runs/route.ts imports but we don't test POST here
vi.mock("@/lib/repositories/mcp-tool-repo", () => ({
  findByCapability: vi.fn().mockResolvedValue([]),
}))
vi.mock("@/lib/mcp/registry", () => ({
  callTool: vi.fn().mockResolvedValue({ content: "ok", isError: false }),
}))
vi.mock("@/lib/services/project-service", () => ({
  getProject: vi.fn().mockResolvedValue({ currentPhase: "recon", currentRound: 1 }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── LLM Logs ──────────────────────────────────────────
describe("GET /api/projects/[projectId]/llm-logs", () => {
  let GET: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/projects/[projectId]/llm-logs/route")
    GET = mod.GET
  })

  it("返回 llm-logs 列表 → 200", async () => {
    const logs = [mockLlmLog(), mockLlmLog({ id: "llmlog-002" })]
    mockLlmLogFindByProject.mockResolvedValue(logs)

    const req = new NextRequest("http://localhost/api/projects/proj-1/llm-logs")
    const res = await GET(req, routeCtx({ projectId: "proj-1" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(2)
    expect(body.items[0].role).toBe("planner")
    expect(mockLlmLogFindByProject).toHaveBeenCalledWith("proj-1")
  })

  it("空列表 → 200 + { items: [] }", async () => {
    mockLlmLogFindByProject.mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/projects/proj-1/llm-logs")
    const res = await GET(req, routeCtx({ projectId: "proj-1" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
  })
})

// ─── MCP Runs ──────────────────────────────────────────
describe("GET /api/projects/[projectId]/mcp-runs", () => {
  let GET: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/projects/[projectId]/mcp-runs/route")
    GET = mod.GET
  })

  it("返回 mcp-runs 列表 → 200", async () => {
    const runs = [mockMcpRun(), mockMcpRun({ id: "run-002", toolName: "curl_http_request" })]
    mockMcpRunFindByProject.mockResolvedValue(runs)

    const req = new NextRequest("http://localhost/api/projects/proj-1/mcp-runs")
    const res = await GET(req, routeCtx({ projectId: "proj-1" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0].toolName).toBe("fscan_port_scan")
    expect(mockMcpRunFindByProject).toHaveBeenCalledWith("proj-1")
  })

  it("空列表 → 200 + []", async () => {
    mockMcpRunFindByProject.mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/projects/proj-1/mcp-runs")
    const res = await GET(req, routeCtx({ projectId: "proj-1" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })
})

// ─── Pipeline Logs ─────────────────────────────────────
describe("GET /api/projects/[projectId]/pipeline-logs", () => {
  let GET: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/projects/[projectId]/pipeline-logs/route")
    GET = mod.GET
  })

  it("返回 pipeline-logs 列表 → 200", async () => {
    const logs = [
      { id: "pl-1", projectId: "proj-1", level: "info", message: "Round started", round: 1, createdAt: new Date() },
      { id: "pl-2", projectId: "proj-1", level: "info", message: "Tool executed", round: 1, createdAt: new Date() },
    ]
    mockPipelineLogFindByProject.mockResolvedValue(logs)
    mockPipelineLogCountByProject.mockResolvedValue(2)

    const req = new NextRequest("http://localhost/api/projects/proj-1/pipeline-logs")
    const res = await GET(req, routeCtx({ projectId: "proj-1" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.logs).toHaveLength(2)
    expect(body.total).toBe(2)
    expect(mockPipelineLogFindByProject).toHaveBeenCalledWith("proj-1", expect.objectContaining({ level: "info" }))
  })

  it("项目不存在 → 返回空（repo 层返回空）", async () => {
    mockPipelineLogFindByProject.mockResolvedValue([])
    mockPipelineLogCountByProject.mockResolvedValue(0)

    const req = new NextRequest("http://localhost/api/projects/nonexistent/pipeline-logs")
    const res = await GET(req, routeCtx({ projectId: "nonexistent" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.logs).toEqual([])
    expect(body.total).toBe(0)
  })
})
