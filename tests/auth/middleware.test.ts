import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"

import { createSessionToken } from "@/lib/auth-session"
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/csrf"
import { middleware } from "@/middleware"

async function makeAuthCookie() {
  const token = await createSessionToken({
    account: "researcher@company.local",
    displayName: "研究员席位 A",
    role: "研究员",
    userId: "user-researcher-a",
  })
  return `prototype_session=${token}`
}

describe("auth middleware", () => {
  it("redirects unauthenticated console requests to login", async () => {
    const request = new NextRequest("http://localhost/dashboard")
    const response = await middleware(request)

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toContain("/login")
  })

  it("allows authenticated requests into protected routes", async () => {
    const cookie = await makeAuthCookie()
    const request = new NextRequest("http://localhost/dashboard", {
      headers: { cookie },
    })

    const response = await middleware(request)

    expect(response.status).toBe(200)
  })

  it("returns 401 for unauthenticated protected api requests", async () => {
    const request = new NextRequest("http://localhost/api/projects")
    const response = await middleware(request)

    expect(response.status).toBe(401)
  })

  it("sets a CSRF cookie for authenticated users", async () => {
    const cookie = await makeAuthCookie()
    const request = new NextRequest("http://localhost/dashboard", {
      headers: { cookie },
    })

    const response = await middleware(request)
    const setCookie = response.headers.get("set-cookie") ?? ""

    expect(setCookie).toContain(CSRF_COOKIE_NAME)
  })

  it("rejects mutating API requests without CSRF token", async () => {
    const cookie = await makeAuthCookie()
    const request = new NextRequest("http://localhost/api/projects", {
      method: "POST",
      headers: { cookie },
    })

    const response = await middleware(request)

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toContain("CSRF")
  })

  it("allows mutating API requests with valid CSRF token", async () => {
    const csrfToken = "test-csrf-token-abc123"
    const cookie = await makeAuthCookie()
    const request = new NextRequest("http://localhost/api/projects", {
      method: "POST",
      headers: {
        cookie: `${cookie}; ${CSRF_COOKIE_NAME}=${csrfToken}`,
        [CSRF_HEADER_NAME]: csrfToken,
      },
    })

    const response = await middleware(request)

    expect(response.status).toBe(200)
  })

  it("allows GET requests without CSRF token", async () => {
    const cookie = await makeAuthCookie()
    const request = new NextRequest("http://localhost/api/projects", {
      method: "GET",
      headers: { cookie },
    })

    const response = await middleware(request)

    expect(response.status).toBe(200)
  })
})
