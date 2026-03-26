import { NextResponse } from "next/server"

import { authenticateResearcher } from "@/lib/auth-repository"
import { AUTH_COOKIE_NAME, createSessionToken } from "@/lib/auth-session"

export async function POST(request: Request) {
  const body = await request.json()
  const result = authenticateResearcher({
    account: typeof body.account === "string" ? body.account : "",
    password: typeof body.password === "string" ? body.password : "",
    captcha: typeof body.captcha === "string" ? body.captcha : "",
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
  })

  return response
}
