import { describe, it, expect, beforeAll } from "vitest"
import { NextRequest } from "next/server"
import { SignJWT } from "jose"
import { middleware } from "@/middleware"

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production"

async function makeToken(): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET)
  return new SignJWT({ userId: "u1", account: "test", role: "researcher" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(secret)
}

function makeReq(path: string, token?: string): NextRequest {
  const req = new NextRequest(new URL(path, "http://localhost:3000"))
  if (token) req.cookies.set("pentest_token", token)
  return req
}

describe("middleware", () => {
  let validToken: string

  beforeAll(async () => {
    validToken = await makeToken()
  })

  it("无 token 访问 API → 401", async () => {
    const res = await middleware(makeReq("/api/projects"))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("有 token 访问 API → next（非 401）", async () => {
    const res = await middleware(makeReq("/api/projects", validToken))

    expect(res.status).not.toBe(401)
    // NextResponse.next() 返回 200 status
    expect(res.headers.get("x-middleware-next")).toBe("1")
  })

  it("公开 API 无需 token — /api/auth/login", async () => {
    const res = await middleware(makeReq("/api/auth/login"))

    expect(res.status).not.toBe(401)
  })

  it("无 token 访问页面 → redirect /login", async () => {
    const res = await middleware(makeReq("/dashboard"))

    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    expect(res.headers.get("location")).toContain("/login")
  })

  it("已登录访问 /login → redirect /dashboard", async () => {
    const res = await middleware(makeReq("/login", validToken))

    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    expect(res.headers.get("location")).toContain("/dashboard")
  })
})
