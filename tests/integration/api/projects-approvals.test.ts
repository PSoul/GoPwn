/**
 * 集成测试：approvals 路由
 *
 * 覆盖：GET /api/projects/[projectId]/approvals
 * 策略：mock service 层
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"
import { NextRequest } from "next/server"
import { routeCtx } from "../../helpers/route-test-utils"
import { mockApproval } from "../../helpers/factories"

// ─── Mock service 层 ────────────────────────────────────

vi.mock("@/lib/services/approval-service", () => ({
  listByProject: vi.fn(),
}))

import { listByProject } from "@/lib/services/approval-service"

// ─── Import route handler ──────────────────────────────

import { GET } from "@/app/api/projects/[projectId]/approvals/route"

// ─── Reset ─────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Helpers ────────────────────────────────────────────

function getReq(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"))
}

// ─── Tests ──────────────────────────────────────────────

describe("GET /api/projects/[projectId]/approvals", () => {
  it("返回审批列表 -> 200", async () => {
    const approvals = [
      mockApproval(),
      mockApproval({ id: "approval-2", status: "approved" }),
    ]
    ;(listByProject as Mock).mockResolvedValueOnce(approvals)

    const res = await GET(
      getReq("/api/projects/proj-test-001/approvals"),
      routeCtx({ projectId: "proj-test-001" }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0].status).toBe("pending")
    expect(body[1].status).toBe("approved")
  })

  it("空列表 -> 200 + []", async () => {
    ;(listByProject as Mock).mockResolvedValueOnce([])

    const res = await GET(
      getReq("/api/projects/proj-test-001/approvals"),
      routeCtx({ projectId: "proj-test-001" }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it("service 传入正确的 projectId", async () => {
    ;(listByProject as Mock).mockResolvedValueOnce([])

    await GET(
      getReq("/api/projects/proj-xyz/approvals"),
      routeCtx({ projectId: "proj-xyz" }),
    )
    expect(listByProject).toHaveBeenCalledWith("proj-xyz")
  })

  it("service 异常 -> 500", async () => {
    ;(listByProject as Mock).mockRejectedValueOnce(new Error("db down"))

    const res = await GET(
      getReq("/api/projects/proj-test-001/approvals"),
      routeCtx({ projectId: "proj-test-001" }),
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.code).toBe("INTERNAL")
  })
})
