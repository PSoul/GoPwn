import { describe, it, expect } from "vitest"
import { apiHandler, json } from "@/lib/infra/api-handler"
import { NotFoundError } from "@/lib/domain/errors"

describe("apiHandler", () => {
  const dummyCtx = { params: Promise.resolve({}) }

  it("正常 handler → 返回原始 Response (200)", async () => {
    const handler = apiHandler(async () => json({ ok: true }))
    const res = await handler(
      new Request("http://localhost/api/test"),
      dummyCtx,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })

  it("handler 抛 DomainError → 返回对应 status + error body", async () => {
    const handler = apiHandler(async () => {
      throw new NotFoundError("Project", "p1")
    })
    const res = await handler(
      new Request("http://localhost/api/test"),
      dummyCtx,
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.code).toBe("NOT_FOUND")
    expect(body.error).toContain("not found")
  })

  it("handler 抛未知异常 → 500 Internal", async () => {
    const handler = apiHandler(async () => {
      throw new Error("boom")
    })
    const res = await handler(
      new Request("http://localhost/api/test"),
      dummyCtx,
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.code).toBe("INTERNAL")
  })
})

describe("json helper", () => {
  it("默认 status 200", () => {
    const res = json({ data: "test" })
    expect(res.status).toBe(200)
  })

  it("自定义 status", () => {
    const res = json({ created: true }, 201)
    expect(res.status).toBe(201)
  })
})
