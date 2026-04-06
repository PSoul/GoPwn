import { describe, it, expect } from "vitest"
import { transition, isTerminal, isActive } from "@/lib/domain/lifecycle"
import { InvalidTransitionError } from "@/lib/domain/errors"

describe("lifecycle: transition()", () => {
  // ── 合法状态转换 ──

  it("idle + START → planning", () => {
    expect(transition("idle", "START")).toBe("planning")
  })

  it("idle + START_REACT → executing", () => {
    expect(transition("idle", "START_REACT")).toBe("executing")
  })

  it("planning + PLAN_READY → executing", () => {
    expect(transition("planning", "PLAN_READY")).toBe("executing")
  })

  it("planning + PLAN_FAILED → failed", () => {
    expect(transition("planning", "PLAN_FAILED")).toBe("failed")
  })

  it("planning + START_REACT → executing", () => {
    expect(transition("planning", "START_REACT")).toBe("executing")
  })

  it("planning + STOP → stopping", () => {
    expect(transition("planning", "STOP")).toBe("stopping")
  })

  it("executing + ALL_DONE → reviewing", () => {
    expect(transition("executing", "ALL_DONE")).toBe("reviewing")
  })

  it("executing + APPROVAL_NEEDED → waiting_approval", () => {
    expect(transition("executing", "APPROVAL_NEEDED")).toBe("waiting_approval")
  })

  it("executing + STOP → stopping", () => {
    expect(transition("executing", "STOP")).toBe("stopping")
  })

  it("waiting_approval + RESOLVED → executing", () => {
    expect(transition("waiting_approval", "RESOLVED")).toBe("executing")
  })

  it("waiting_approval + STOP → stopping", () => {
    expect(transition("waiting_approval", "STOP")).toBe("stopping")
  })

  it("reviewing + CONTINUE → planning", () => {
    expect(transition("reviewing", "CONTINUE")).toBe("planning")
  })

  it("reviewing + CONTINUE_REACT → executing", () => {
    expect(transition("reviewing", "CONTINUE_REACT")).toBe("executing")
  })

  it("reviewing + SETTLE → settling", () => {
    expect(transition("reviewing", "SETTLE")).toBe("settling")
  })

  it("reviewing + STOP → stopping", () => {
    expect(transition("reviewing", "STOP")).toBe("stopping")
  })

  it("settling + SETTLED → completed", () => {
    expect(transition("settling", "SETTLED")).toBe("completed")
  })

  it("settling + FAILED → failed", () => {
    expect(transition("settling", "FAILED")).toBe("failed")
  })

  it("stopping + STOPPED → stopped", () => {
    expect(transition("stopping", "STOPPED")).toBe("stopped")
  })

  it("failed + RETRY → planning", () => {
    expect(transition("failed", "RETRY")).toBe("planning")
  })

  it("failed + RETRY_REACT → executing（从失败状态重试进入 ReAct）", () => {
    expect(transition("failed", "RETRY_REACT")).toBe("executing")
  })

  it("failed + STOP → stopping", () => {
    expect(transition("failed", "STOP")).toBe("stopping")
  })

  // ── 非法转换 ──

  it("idle + ALL_DONE → 抛出 InvalidTransitionError", () => {
    expect(() => transition("idle", "ALL_DONE")).toThrow(InvalidTransitionError)
  })

  it("stopped + START_REACT → 抛错（终态不可转换）", () => {
    expect(() => transition("stopped", "START_REACT")).toThrow(InvalidTransitionError)
  })

  it("completed + RETRY → 抛错（终态不可转换）", () => {
    expect(() => transition("completed", "RETRY")).toThrow(InvalidTransitionError)
  })

  it("idle + SETTLED → 抛错", () => {
    expect(() => transition("idle", "SETTLED")).toThrow(InvalidTransitionError)
  })

  it("executing + RETRY → 抛错（只有 failed 才能 retry）", () => {
    expect(() => transition("executing", "RETRY")).toThrow(InvalidTransitionError)
  })

  it("planning + ALL_DONE → 抛错（planning 无法直接完成）", () => {
    expect(() => transition("planning", "ALL_DONE")).toThrow(InvalidTransitionError)
  })

  it("非法转换的错误信息包含状态和事件", () => {
    try {
      transition("idle", "SETTLED")
      expect.unreachable("应该抛错")
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidTransitionError)
      expect((err as InvalidTransitionError).message).toContain("SETTLED")
      expect((err as InvalidTransitionError).message).toContain("idle")
    }
  })
})

describe("lifecycle: isTerminal()", () => {
  it("completed 是终态", () => {
    expect(isTerminal("completed")).toBe(true)
  })

  it("stopped 是终态", () => {
    expect(isTerminal("stopped")).toBe(true)
  })

  it("idle 不是终态", () => {
    expect(isTerminal("idle")).toBe(false)
  })

  it("executing 不是终态", () => {
    expect(isTerminal("executing")).toBe(false)
  })

  it("failed 不是终态", () => {
    expect(isTerminal("failed")).toBe(false)
  })

  it("planning 不是终态", () => {
    expect(isTerminal("planning")).toBe(false)
  })

  it("settling 不是终态", () => {
    expect(isTerminal("settling")).toBe(false)
  })

  it("stopping 不是终态", () => {
    expect(isTerminal("stopping")).toBe(false)
  })
})

describe("lifecycle: isActive()", () => {
  // 活跃状态：非终态、非 idle、非 failed
  const activeStates = ["planning", "executing", "waiting_approval", "reviewing", "settling", "stopping"] as const
  for (const state of activeStates) {
    it(`${state} 是活跃状态`, () => {
      expect(isActive(state)).toBe(true)
    })
  }

  // 非活跃状态
  it("idle 不是活跃状态", () => {
    expect(isActive("idle")).toBe(false)
  })

  it("failed 不是活跃状态", () => {
    expect(isActive("failed")).toBe(false)
  })

  it("completed 不是活跃状态", () => {
    expect(isActive("completed")).toBe(false)
  })

  it("stopped 不是活跃状态", () => {
    expect(isActive("stopped")).toBe(false)
  })
})
