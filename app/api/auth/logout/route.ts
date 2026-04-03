import { NextResponse } from "next/server"

import { recordLogout } from "@/lib/auth/auth-repository"
import { AUTH_COOKIE_NAME, readSessionFromCookieHeader } from "@/lib/auth/auth-session"
import { withApiHandler } from "@/lib/infra/api-handler"

export const POST = withApiHandler(async (request) => {
  const session = await readSessionFromCookieHeader(request.headers.get("cookie"))

  if (session) {
    await recordLogout(session.account, session.displayName)
  }

  const acceptsHtml = request.headers.get("accept")?.includes("text/html")
  const response = acceptsHtml
    ? NextResponse.redirect(new URL("/login", request.url), { status: 303 })
    : NextResponse.json({ ok: true })

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  })

  return response
})
