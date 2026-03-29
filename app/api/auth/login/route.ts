import { type NextRequest, NextResponse } from "next/server"

import { authenticateResearcher } from "@/lib/auth-repository"
import { AUTH_COOKIE_NAME, createSessionToken } from "@/lib/auth-session"
import { CSRF_COOKIE_NAME } from "@/lib/csrf"
import { withApiHandler } from "@/lib/api-handler"

export const POST = withApiHandler(async (request) => {
  const nextReq = request as NextRequest
  const body = await request.json()
  const result = authenticateResearcher({
    account: typeof body.account === "string" ? body.account : "",
    password: typeof body.password === "string" ? body.password : "",
    captcha: typeof body.captcha === "string" ? body.captcha : "",
    captchaId: typeof body.captchaId === "string" ? body.captchaId : "",
  })

  if (!result.user) {
    return NextResponse.json({ error: result.error }, { status: 401 })
  }

  const redirectTo =
    typeof body.redirectTo === "string" && body.redirectTo.startsWith("/")
      ? body.redirectTo
      : "/dashboard"

  const response = NextResponse.json({
    redirectTo,
    user: {
      account: result.user.account,
      displayName: result.user.displayName,
      role: result.user.role,
    },
  })

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: await createSessionToken({
      account: result.user.account,
      displayName: result.user.displayName,
      role: result.user.role,
      userId: result.user.id,
    }),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
  })

  // Set CSRF cookie immediately so subsequent mutations work without an extra round-trip
  if (!nextReq.cookies.get(CSRF_COOKIE_NAME)?.value) {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    const csrfToken = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")
    response.cookies.set({
      name: CSRF_COOKIE_NAME,
      value: csrfToken,
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    })
  }

  return response
})
