import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"

import { createSessionToken } from "@/lib/auth-session"
import { middleware } from "@/middleware"

describe("auth middleware", () => {
  it("redirects unauthenticated console requests to login", async () => {
    const request = new NextRequest("http://localhost/dashboard")
    const response = await middleware(request)

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toContain("/login")
  })

  it("allows authenticated requests into protected routes", async () => {
    const token = await createSessionToken({
      account: "researcher@company.local",
      displayName: "研究员席位 A",
      role: "研究员",
      userId: "user-researcher-a",
    })

    const request = new NextRequest("http://localhost/dashboard", {
      headers: {
        cookie: `prototype_session=${token}`,
      },
    })

    const response = await middleware(request)

    expect(response.status).toBe(200)
  })

  it("returns 401 for unauthenticated protected api requests", async () => {
    const request = new NextRequest("http://localhost/api/projects")
    const response = await middleware(request)

    expect(response.status).toBe(401)
  })
})
