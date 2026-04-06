import { describe, it, expect } from "vitest"
import {
  DomainError,
  NotFoundError,
  InvalidTransitionError,
  ConflictError,
  UnauthorizedError,
} from "@/lib/domain/errors"

describe("DomainError", () => {
  it("基本属性正确", () => {
    const err = new DomainError("something wrong", "SOME_CODE", 422)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("DomainError")
    expect(err.message).toBe("something wrong")
    expect(err.code).toBe("SOME_CODE")
    expect(err.statusCode).toBe(422)
  })

  it("statusCode 默认 400", () => {
    const err = new DomainError("bad", "BAD")
    expect(err.statusCode).toBe(400)
  })
})

describe("NotFoundError", () => {
  it("继承 DomainError，状态码 404", () => {
    const err = new NotFoundError("Project", "proj-123")
    expect(err).toBeInstanceOf(DomainError)
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe("NOT_FOUND")
    expect(err.statusCode).toBe(404)
    expect(err.message).toBe("Project proj-123 not found")
  })
})

describe("InvalidTransitionError", () => {
  it("继承 DomainError，状态码 409", () => {
    const err = new InvalidTransitionError("idle", "ROUND_DONE")
    expect(err).toBeInstanceOf(DomainError)
    expect(err.code).toBe("INVALID_TRANSITION")
    expect(err.statusCode).toBe(409)
    expect(err.message).toContain("idle")
    expect(err.message).toContain("ROUND_DONE")
  })
})

describe("ConflictError", () => {
  it("继承 DomainError，状态码 409", () => {
    const err = new ConflictError("already exists")
    expect(err).toBeInstanceOf(DomainError)
    expect(err.code).toBe("CONFLICT")
    expect(err.statusCode).toBe(409)
    expect(err.message).toBe("already exists")
  })
})

describe("UnauthorizedError", () => {
  it("默认消息 Unauthorized", () => {
    const err = new UnauthorizedError()
    expect(err).toBeInstanceOf(DomainError)
    expect(err.code).toBe("UNAUTHORIZED")
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe("Unauthorized")
  })

  it("可自定义消息", () => {
    const err = new UnauthorizedError("token expired")
    expect(err.message).toBe("token expired")
  })
})
