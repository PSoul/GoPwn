import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { readSessionToken } from "@/lib/auth-session"

function getLoginRedirect(request: NextRequest) {
  const url = new URL("/login", request.url)
  url.searchParams.set("from", request.nextUrl.pathname)

  return NextResponse.redirect(url)
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const session = await readSessionToken(request.cookies.get("prototype_session")?.value)
  const isApiRoute = pathname.startsWith("/api")
  const isPublicPage = pathname === "/login"
  const isPublicApi = pathname === "/api/auth/login" || pathname === "/api/auth/logout"

  if (isApiRoute && !isPublicApi && !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isApiRoute && !isPublicPage && !session) {
    return getLoginRedirect(request)
  }

  if (isPublicPage && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
}
