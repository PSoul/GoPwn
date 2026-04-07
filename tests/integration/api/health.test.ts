/**
 * 集成测试：health 路由
 *
 * 直接 mock prisma.$queryRaw 控制成功/失败。
 */
import { describe, it, expect, vi } from "vitest"

const mockQueryRaw = vi.fn()
vi.mock("@/lib/infra/prisma", () => ({
  prisma: { $queryRaw: mockQueryRaw },
}))

// 动态 import
let GET: typeof import("@/app/api/health/route").GET
beforeAll(async () => {
  const mod = await import("@/app/api/health/route")
  GET = mod.GET
})

import { beforeAll } from "vitest"

describe("GET /api/health", () => {
  it("数据库正常 -> 200 + status ok", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ "?column?": 1 }])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("ok")
    expect(body.database).toBe("connected")
  })

  it("数据库连接失败 -> 503 + status error", async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error("connection refused"))

    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.status).toBe("error")
    expect(body.database).toBe("disconnected")
  })
})
