import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { readSessionToken } from "@/lib/auth/auth-session"
import { ensureCsrfCookie, verifyCsrfToken } from "@/lib/auth/csrf"
import { loginLimiter, apiLimiter } from "@/lib/auth/rate-limit"

function getLoginRedirect(request: NextRequest) {
  const url = new URL("/login", request.url)
  url.searchParams.set("from", request.nextUrl.pathname)

  return NextResponse.redirect(url)
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  )
}

function rateLimitResponse(retryAfterMs: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
    },
  )
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const session = await readSessionToken(request.cookies.get("prototype_session")?.value)
  const isApiRoute = pathname.startsWith("/api")
  const isPublicPage = pathname === "/login"
  const isLoginApi = pathname === "/api/auth/login"
  const isPublicApi = isLoginApi || pathname === "/api/auth/logout" || pathname === "/api/auth/captcha" || pathname === "/api/health"

  // Rate limiting — login endpoint (stricter)
  if (isLoginApi && request.method === "POST") {
    const ip = getClientIp(request)
    const result = loginLimiter(ip)
    if (!result.allowed) {
      return rateLimitResponse(result.retryAfterMs)
    }
  }

  // Rate limiting — general API
  if (isApiRoute && !isLoginApi) {
    const ip = getClientIp(request)
    const result = apiLimiter(ip)
    if (!result.allowed) {
      return rateLimitResponse(result.retryAfterMs)
    }
  }

  if (isApiRoute && !isPublicApi && !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isApiRoute && !isPublicPage && !session) {
    return getLoginRedirect(request)
  }

  if (isPublicPage && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // CSRF verification for authenticated API mutations
  // Skip in E2E/test mode to avoid captcha + CSRF friction in automated tests
  const isTestMode = process.env.E2E_TEST_MODE === "true"
  if (isApiRoute && !isPublicApi && session && !isTestMode) {
    const csrfError = verifyCsrfToken(request)
    if (csrfError) {
      return csrfError
    }
  }

  // Ensure CSRF cookie exists for authenticated users
  const response = NextResponse.next()
  if (session) {
    return ensureCsrfCookie(request, response)
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
}
