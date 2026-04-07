/**
 * 集成测试：auth 路由 (login / logout)
 *
 * login 路由直接使用 prisma 查询用户，需要 PGlite 内存数据库。
 * logout 路由调用 clearAuthCookie，需要 mock next/headers cookies()。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { createTestDb, type TestDb } from "../../helpers/pglite-prisma"
import { NextRequest } from "next/server"
import bcrypt from "bcryptjs"

// ─── Mocks ──────────────────────────────────────────────

let testDb: TestDb
vi.mock("@/lib/infra/prisma", () => ({ prisma: null as unknown }))

const mockCookieStore = {
  set: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
}
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(mockCookieStore),
}))

// ─── Setup / Teardown ───────────────────────────────────

beforeAll(async () => {
  testDb = await createTestDb()
  const mod = await import("@/lib/infra/prisma")
  ;(mod as any).prisma = testDb.prisma
}, 30_000)

afterAll(async () => {
  await testDb?.cleanup()
})

beforeEach(async () => {
  await testDb.truncateAll()
  mockCookieStore.set.mockClear()
  mockCookieStore.delete.mockClear()
  mockCookieStore.get.mockClear()
})

// ─── Helpers ────────────────────────────────────────────

async function seedUser(
  account = "researcher@test.local",
  password = "correct-password",
) {
  const hashed = await bcrypt.hash(password, 10)
  return testDb.prisma.user.create({
    data: {
      account,
      password: hashed,
      displayName: "Test Researcher",
      role: "researcher",
    },
  })
}

function loginReq(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
}

const emptyCtx = { params: Promise.resolve({}) }

// ─── Tests ──────────────────────────────────────────────

// 动态 import 路由 handler（必须在 vi.mock 之后）
let loginHandler: typeof import("@/app/api/auth/login/route").POST
let logoutHandler: typeof import("@/app/api/auth/logout/route").POST

beforeAll(async () => {
  const loginMod = await import("@/app/api/auth/login/route")
  loginHandler = loginMod.POST
  const logoutMod = await import("@/app/api/auth/logout/route")
  logoutHandler = logoutMod.POST
})

describe("POST /api/auth/login", () => {
  it("正确凭据 -> 200 + 设置 cookie", async () => {
    await seedUser()
    const res = await loginHandler(loginReq({
      account: "researcher@test.local",
      password: "correct-password",
    }), emptyCtx)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.account).toBe("researcher@test.local")
    expect(body.user.displayName).toBe("Test Researcher")
    expect(body.user.role).toBe("researcher")
    expect(body.user.id).toBeDefined()
    // cookie 被设置
    expect(mockCookieStore.set).toHaveBeenCalled()
  })

  it("错误密码 -> 401", async () => {
    await seedUser()
    const res = await loginHandler(loginReq({
      account: "researcher@test.local",
      password: "wrong-password",
    }), emptyCtx)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Invalid credentials")
  })

  it("不存在的账号 -> 401", async () => {
    const res = await loginHandler(loginReq({
      account: "nobody@test.local",
      password: "any-password",
    }), emptyCtx)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Invalid credentials")
  })

  it("空 body -> 500 (apiHandler 捕获)", async () => {
    // 发送空字符串会导致 JSON 解析失败
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json" },
    })
    const res = await loginHandler(req, emptyCtx)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Internal server error")
  })
})

describe("POST /api/auth/logout", () => {
  it("正常登出 -> 200 + 清除 cookie", async () => {
    const req = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
    })
    const res = await logoutHandler(req, emptyCtx)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(mockCookieStore.delete).toHaveBeenCalled()
  })

  it("多次登出也应正常返回 200", async () => {
    const req1 = new NextRequest("http://localhost/api/auth/logout", { method: "POST" })
    const res1 = await logoutHandler(req1, emptyCtx)
    expect(res1.status).toBe(200)

    const req2 = new NextRequest("http://localhost/api/auth/logout", { method: "POST" })
    const res2 = await logoutHandler(req2, emptyCtx)
    expect(res2.status).toBe(200)
  })
})
