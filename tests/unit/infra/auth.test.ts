import { describe, it, expect, vi } from "vitest"

// mock next/headers cookies — auth.ts 中 requireAuth 需要
const mockCookieStore = {
  set: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
}
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(mockCookieStore),
}))

import { signToken, verifyToken, requireAuth } from "@/lib/infra/auth"

describe("auth — signToken / verifyToken 纯函数", () => {
  it("signToken + verifyToken — 往返一致", async () => {
    const payload = { userId: "u1", account: "test@local", role: "researcher" }
    const token = await signToken(payload)
    expect(typeof token).toBe("string")
    expect(token.length).toBeGreaterThan(0)

    const decoded = await verifyToken(token)
    expect(decoded.userId).toBe("u1")
    expect(decoded.account).toBe("test@local")
    expect(decoded.role).toBe("researcher")
  })

  it("verifyToken — 非法 token → throw", async () => {
    await expect(verifyToken("invalid-jwt-string")).rejects.toThrow()
  })

  it("verifyToken — 空字符串 → throw", async () => {
    await expect(verifyToken("")).rejects.toThrow()
  })
})

describe("auth — requireAuth", () => {
  it("无 cookie → throw UnauthorizedError", async () => {
    mockCookieStore.get.mockReturnValue(undefined)
    await expect(requireAuth()).rejects.toThrow("Unauthorized")
  })

  it("有效 cookie → 返回 payload", async () => {
    const token = await signToken({
      userId: "u2",
      account: "admin@local",
      role: "admin",
    })
    mockCookieStore.get.mockReturnValue({ value: token })
    const result = await requireAuth()
    expect(result.userId).toBe("u2")
    expect(result.account).toBe("admin@local")
  })

  it("无效 cookie → throw UnauthorizedError", async () => {
    mockCookieStore.get.mockReturnValue({ value: "bad-token" })
    await expect(requireAuth()).rejects.toThrow()
  })
})
