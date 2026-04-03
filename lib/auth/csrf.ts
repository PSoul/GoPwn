/**
 * CSRF protection using double-submit cookie pattern.
 *
 * Flow:
 *   1. Middleware sets a `csrf_token` cookie on every response (readable by JS).
 *   2. Client reads the cookie and sends the value as `X-CSRF-Token` header.
 *   3. Middleware verifies header matches cookie on state-mutating requests.
 *
 * This prevents cross-origin attacks because foreign origins cannot read our cookies.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export const CSRF_COOKIE_NAME = "csrf_token"
export const CSRF_HEADER_NAME = "x-csrf-token"

const CSRF_TOKEN_LENGTH = 32 // 32 random bytes → 64 hex chars

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

/** Generate a random hex token */
function generateCsrfToken(): string {
  const bytes = new Uint8Array(CSRF_TOKEN_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Ensure the response has a CSRF cookie set.
 * Call this in middleware for every authenticated response.
 */
export function ensureCsrfCookie(request: NextRequest, response: NextResponse): NextResponse {
  const existing = request.cookies.get(CSRF_COOKIE_NAME)?.value
  if (existing) {
    return response
  }

  const token = generateCsrfToken()
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // must be readable by JS
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  })

  return response
}

/**
 * Verify CSRF token on mutating requests.
 * Returns null if valid, or an error Response if invalid.
 */
export function verifyCsrfToken(request: NextRequest): Response | null {
  if (!MUTATING_METHODS.has(request.method)) {
    return null // GET/HEAD/OPTIONS don't need CSRF
  }

  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
  const headerToken = request.headers.get(CSRF_HEADER_NAME)

  if (!cookieToken || !headerToken) {
    return NextResponse.json(
      { error: "CSRF token missing" },
      { status: 403 },
    )
  }

  if (cookieToken !== headerToken) {
    return NextResponse.json(
      { error: "CSRF token mismatch" },
      { status: 403 },
    )
  }

  return null
}
