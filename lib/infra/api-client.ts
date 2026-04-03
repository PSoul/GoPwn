"use client"

/**
 * Shared API client for frontend components.
 * Automatically includes CSRF token header on mutating requests.
 */

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/auth/csrf"

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`))
  return match ? match.slice(CSRF_COOKIE_NAME.length + 1) : null
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

/**
 * Drop-in replacement for `fetch()` that automatically adds CSRF headers.
 * Usage: `import { apiFetch } from "@/lib/infra/api-client"`
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase()

  if (MUTATING_METHODS.has(method)) {
    const csrfToken = getCsrfToken()
    if (csrfToken) {
      const headers = new Headers(init?.headers)
      headers.set(CSRF_HEADER_NAME, csrfToken)
      return fetch(input, { ...init, headers })
    }
  }

  return fetch(input, init)
}
