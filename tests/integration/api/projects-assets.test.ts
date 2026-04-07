/**
 * 集成测试：assets 路由
 *
 * 覆盖：GET /api/projects/[projectId]/assets
 * 策略：mock service 层
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"
import { NextRequest } from "next/server"
import { routeCtx } from "../../helpers/route-test-utils"
import { mockAsset } from "../../helpers/factories"

// ─── Mock service 层 ────────────────────────────────────

vi.mock("@/lib/services/asset-service", () => ({
  listByProject: vi.fn(),
  getAssetTree: vi.fn(),
}))

import { listByProject, getAssetTree } from "@/lib/services/asset-service"

// ─── Import route handler ──────────────────────────────

import { GET } from "@/app/api/projects/[projectId]/assets/route"

// ─── Reset ─────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Helpers ────────────────────────────────────────────

function getReq(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"))
}

// ─── Tests ──────────────────────────────────────────────

describe("GET /api/projects/[projectId]/assets", () => {
  it("返回资产列表 -> 200", async () => {
    const assets = [
      mockAsset(),
      mockAsset({ id: "asset-2", kind: "service", value: "127.0.0.1:443" }),
    ]
    ;(listByProject as Mock).mockResolvedValueOnce(assets)

    const res = await GET(
      getReq("/api/projects/proj-test-001/assets"),
      routeCtx({ projectId: "proj-test-001" }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0].kind).toBe("port")
    expect(listByProject).toHaveBeenCalledWith("proj-test-001")
  })

  it("空列表 -> 200 + []", async () => {
    ;(listByProject as Mock).mockResolvedValueOnce([])

    const res = await GET(
      getReq("/api/projects/proj-test-001/assets"),
      routeCtx({ projectId: "proj-test-001" }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it("view=tree -> 调用 getAssetTree", async () => {
    const treeData = [
      { ...mockAsset(), children: [mockAsset({ id: "child-1", parentId: "asset-test-001" })] },
    ]
    ;(getAssetTree as Mock).mockResolvedValueOnce(treeData)

    const res = await GET(
      getReq("/api/projects/proj-test-001/assets?view=tree"),
      routeCtx({ projectId: "proj-test-001" }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(getAssetTree).toHaveBeenCalledWith("proj-test-001")
    // listByProject 不应被调用
    expect(listByProject).not.toHaveBeenCalled()
  })

  it("service 异常 -> 500", async () => {
    ;(listByProject as Mock).mockRejectedValueOnce(new Error("db error"))

    const res = await GET(
      getReq("/api/projects/proj-test-001/assets"),
      routeCtx({ projectId: "proj-test-001" }),
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.code).toBe("INTERNAL")
  })
})
