// @vitest-environment node
import { describe, expect, it } from "vitest"

import { ApiError, withApiHandler } from "@/lib/infra/api-handler"
import type { ApiErrorCode } from "@/lib/infra/api-handler"

describe("ApiError", () => {
  it("infers VALIDATION code from 400 status", () => {
    const error = new ApiError(400, "Invalid input")
    expect(error.code).toBe("VALIDATION")
    expect(error.statusCode).toBe(400)
    expect(error.message).toBe("Invalid input")
  })

  it("infers AUTH_REQUIRED code from 401 status", () => {
    const error = new ApiError(401, "Unauthorized")
    expect(error.code).toBe("AUTH_REQUIRED")
  })

  it("infers FORBIDDEN code from 403 status", () => {
    const error = new ApiError(403, "Access denied")
    expect(error.code).toBe("FORBIDDEN")
  })

  it("infers NOT_FOUND code from 404 status", () => {
    const error = new ApiError(404, "Not found")
    expect(error.code).toBe("NOT_FOUND")
  })

  it("infers RATE_LIMITED code from 429 status", () => {
    const error = new ApiError(429, "Too many requests")
    expect(error.code).toBe("RATE_LIMITED")
  })

  it("infers INTERNAL code from 500 status", () => {
    const error = new ApiError(500, "Server error")
    expect(error.code).toBe("INTERNAL")
  })

  it("allows explicit code override", () => {
    const error = new ApiError(401, "Bad credentials", "AUTH_INVALID")
    expect(error.code).toBe("AUTH_INVALID")
    expect(error.statusCode).toBe(401)
  })

  it("inherits from Error", () => {
    const error = new ApiError(500, "test")
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe("ApiError")
  })
})

describe("withApiHandler", () => {
  function makeRequest(method = "GET", url = "http://localhost/api/test"): Request {
    return new Request(url, { method })
  }

  const routeContext = { params: Promise.resolve({}) }

  it("passes through successful responses", async () => {
    const handler = withApiHandler(async () => {
      return Response.json({ ok: true })
    })
    const response = await handler(makeRequest(), routeContext)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
  })

  it("catches ApiError and returns structured error with code", async () => {
    const handler = withApiHandler(async () => {
      throw new ApiError(404, "Project not found")
    })
    const response = await handler(makeRequest(), routeContext)
    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Project not found")
    expect(body.code).toBe("NOT_FOUND")
  })

  it("catches ApiError with explicit code", async () => {
    const handler = withApiHandler(async () => {
      throw new ApiError(503, "LLM provider unreachable", "SERVICE_UNAVAILABLE")
    })
    const response = await handler(makeRequest(), routeContext)
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.code).toBe("SERVICE_UNAVAILABLE")
  })

  it("catches unexpected errors and returns 500 with INTERNAL code", async () => {
    const handler = withApiHandler(async () => {
      throw new TypeError("Cannot read property of undefined")
    })
    const response = await handler(makeRequest(), routeContext)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe("Internal server error")
    expect(body.code).toBe("INTERNAL")
  })
})
