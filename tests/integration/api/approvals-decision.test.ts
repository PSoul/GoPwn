/**
 * API 路由测试：approvals decision (PUT/PATCH)
 * Mock approval-service，直接调用 route handler
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"
import { NextRequest } from "next/server"
import { routeCtx } from "../../helpers/route-test-utils"
import { mockApproval } from "../../helpers/factories"

// ─── Mock approval service ─────────────────────────────
const mockDecide = vi.fn()
vi.mock("@/lib/services/approval-service", () => ({
  decide: (...args: unknown[]) => mockDecide(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe("PUT /api/approvals/[approvalId]", () => {
  let PUT: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/approvals/[approvalId]/route")
    PUT = mod.PUT
  })

  it("approve pending → 202 + 状态变更", async () => {
    mockDecide.mockResolvedValue(mockApproval({ status: "approved", decidedAt: new Date() }))

    const req = new NextRequest("http://localhost/api/approvals/approval-1", {
      method: "PUT",
      body: JSON.stringify({ decision: "approved", note: "同意执行" }),
    })
    const res = await PUT(req, routeCtx({ approvalId: "approval-1" }))

    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.approval.status).toBe("approved")
    expect(mockDecide).toHaveBeenCalledWith("approval-1", "approved", "同意执行")
  })

  it("reject pending → 202 + 状态变更", async () => {
    mockDecide.mockResolvedValue(mockApproval({ status: "rejected", decidedAt: new Date() }))

    const req = new NextRequest("http://localhost/api/approvals/approval-1", {
      method: "PUT",
      body: JSON.stringify({ decision: "rejected", note: "风险过高" }),
    })
    const res = await PUT(req, routeCtx({ approvalId: "approval-1" }))

    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.approval.status).toBe("rejected")
  })

  it("已决定再 decide → 409", async () => {
    const { ConflictError } = await import("@/lib/domain/errors")
    mockDecide.mockRejectedValue(new ConflictError("Approval already resolved"))

    const req = new NextRequest("http://localhost/api/approvals/approval-1", {
      method: "PUT",
      body: JSON.stringify({ decision: "approved" }),
    })
    const res = await PUT(req, routeCtx({ approvalId: "approval-1" }))

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe("CONFLICT")
  })

  it("审批不存在 → 404", async () => {
    const { NotFoundError } = await import("@/lib/domain/errors")
    mockDecide.mockRejectedValue(new NotFoundError("Approval", "nonexistent"))

    const req = new NextRequest("http://localhost/api/approvals/nonexistent", {
      method: "PUT",
      body: JSON.stringify({ decision: "approved" }),
    })
    const res = await PUT(req, routeCtx({ approvalId: "nonexistent" }))

    expect(res.status).toBe(404)
  })

  it("缺少 decision 字段 → 500（JSON 解析后 undefined 传入 service 导致错误）", async () => {
    mockDecide.mockRejectedValue(new Error("Invalid decision"))

    const req = new NextRequest("http://localhost/api/approvals/approval-1", {
      method: "PUT",
      body: JSON.stringify({}),
    })
    const res = await PUT(req, routeCtx({ approvalId: "approval-1" }))

    expect(res.status).toBe(500)
  })
})

describe("PATCH /api/approvals/[approvalId]", () => {
  let PATCH: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

  beforeEach(async () => {
    const mod = await import("@/app/api/approvals/[approvalId]/route")
    PATCH = mod.PATCH
  })

  it("PATCH 与 PUT 行为一致 → 202", async () => {
    mockDecide.mockResolvedValue(mockApproval({ status: "approved", decidedAt: new Date() }))

    const req = new NextRequest("http://localhost/api/approvals/approval-1", {
      method: "PATCH",
      body: JSON.stringify({ decision: "approved" }),
    })
    const res = await PATCH(req, routeCtx({ approvalId: "approval-1" }))

    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.approval.status).toBe("approved")
    expect(mockDecide).toHaveBeenCalledWith("approval-1", "approved")
  })
})
