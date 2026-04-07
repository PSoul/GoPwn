import { describe, it, expect, beforeEach } from "vitest"
import {
  registerAbort,
  unregisterAbort,
  abortAllForProject,
} from "@/lib/infra/abort-registry"

describe("abort-registry", () => {
  // 每次测试前清理可能残留的 controller
  beforeEach(() => {
    abortAllForProject("p1")
    abortAllForProject("p2")
  })

  it("registerAbort + abortAllForProject → controller 被 abort", () => {
    const ac = new AbortController()
    registerAbort("p1", ac)
    abortAllForProject("p1")
    expect(ac.signal.aborted).toBe(true)
  })

  it("unregisterAbort → 不再被 abort", () => {
    const ac = new AbortController()
    registerAbort("p1", ac)
    unregisterAbort("p1", ac)
    abortAllForProject("p1")
    expect(ac.signal.aborted).toBe(false)
  })

  it("多个 controller → 全部被 abort", () => {
    const ac1 = new AbortController()
    const ac2 = new AbortController()
    registerAbort("p1", ac1)
    registerAbort("p1", ac2)
    abortAllForProject("p1")
    expect(ac1.signal.aborted).toBe(true)
    expect(ac2.signal.aborted).toBe(true)
  })

  it("abortAllForProject — 不存在的项目 → 不崩溃", () => {
    expect(() => abortAllForProject("nonexistent")).not.toThrow()
  })
})
