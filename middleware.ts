import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { jwtVerify } from "jose"

const COOKIE_NAME = "pentest_token"

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || "dev-secret-change-in-production"
  return new TextEncoder().encode(secret)
}

function getLoginRedirect(request: NextRequest) {
  const url = new URL("/login", request.url)
  url.searchParams.set("from", request.nextUrl.pathname)
  return NextResponse.redirect(url)
}

async function verifySession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return false
  try {
    await jwtVerify(token, getJwtSecret())
    return true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isApiRoute = pathname.startsWith("/api")
  const isPublicPage = pathname === "/login"
  const isPublicApi =
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/health"

  const authenticated = await verifySession(request)

  // Unauthenticated API requests (except public endpoints)
  if (isApiRoute && !isPublicApi && !authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Unauthenticated page requests (except login)
  if (!isApiRoute && !isPublicPage && !authenticated) {
    return getLoginRedirect(request)
  }

  // Redirect authenticated users away from login page
  if (isPublicPage && authenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
}
