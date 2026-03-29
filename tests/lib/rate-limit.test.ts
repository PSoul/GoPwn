import { describe, expect, it } from "vitest"

import { createRateLimiter } from "@/lib/rate-limit"

describe("createRateLimiter", () => {
  it("allows requests within the limit", () => {
    const check = createRateLimiter({ windowMs: 60_000, maxRequests: 3 })

    expect(check("ip-1").allowed).toBe(true)
    expect(check("ip-1").allowed).toBe(true)
    expect(check("ip-1").allowed).toBe(true)
    expect(check("ip-1").remaining).toBe(0)
  })

  it("rejects requests over the limit", () => {
    const check = createRateLimiter({ windowMs: 60_000, maxRequests: 2 })

    check("ip-1")
    check("ip-1")
    const result = check("ip-1")

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it("tracks keys independently", () => {
    const check = createRateLimiter({ windowMs: 60_000, maxRequests: 1 })

    expect(check("ip-1").allowed).toBe(true)
    expect(check("ip-2").allowed).toBe(true)
    expect(check("ip-1").allowed).toBe(false)
  })
})
