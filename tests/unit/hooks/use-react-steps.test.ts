import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { MockEventSource } from "../../helpers/mock-event-source"
import { useReactSteps } from "@/lib/hooks/use-react-steps"

beforeEach(() => {
  MockEventSource.reset()
  vi.stubGlobal("EventSource", MockEventSource)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

// 辅助：获取最近创建的 MockEventSource 实例
function latestES() {
  return MockEventSource.instances[MockEventSource.instances.length - 1]
}

// 辅助：发送事件
function sendEvent(es: MockEventSource, type: string, data: Record<string, unknown>) {
  es.triggerMessage(
    JSON.stringify({
      type,
      projectId: "p1",
      timestamp: new Date().toISOString(),
      data,
    }),
  )
}

describe("useReactSteps", () => {
  it("react_step_started 事件添加活跃步骤", () => {
    const { result } = renderHook(() => useReactSteps("p1"))

    act(() => {
      sendEvent(latestES(), "react_step_started", {
        round: 1,
        stepIndex: 0,
        thought: "扫描",
        toolName: "nmap_scan",
      })
    })

    expect(result.current.activeSteps).toHaveLength(1)
    expect(result.current.activeSteps[0]).toMatchObject({
      round: 1,
      stepIndex: 0,
      thought: "扫描",
      toolName: "nmap_scan",
      status: "running",
    })
  })

  it("react_step_completed 更新步骤状态", () => {
    const { result } = renderHook(() => useReactSteps("p1"))

    act(() => {
      sendEvent(latestES(), "react_step_started", {
        round: 1,
        stepIndex: 0,
        thought: "扫描",
        toolName: "nmap_scan",
      })
    })
    expect(result.current.activeSteps[0].status).toBe("running")

    act(() => {
      sendEvent(latestES(), "react_step_completed", {
        round: 1,
        stepIndex: 0,
        status: "done",
        outputPreview: "发现3个端口",
      })
    })

    expect(result.current.activeSteps[0].status).toBe("done")
    expect(result.current.activeSteps[0].outputPreview).toBe("发现3个端口")
  })

  it("round_reviewed 重置活跃步骤和进度", () => {
    const { result } = renderHook(() => useReactSteps("p1"))

    // 先添加步骤和进度
    act(() => {
      sendEvent(latestES(), "react_step_started", {
        round: 1,
        stepIndex: 0,
        thought: "扫描",
        toolName: "nmap_scan",
      })
      sendEvent(latestES(), "react_round_progress", {
        round: 1,
        currentStep: 1,
        maxSteps: 5,
        phase: "scanning",
      })
    })
    expect(result.current.activeSteps).toHaveLength(1)
    expect(result.current.roundProgress).not.toBeNull()

    // round_reviewed 重置
    act(() => {
      sendEvent(latestES(), "round_reviewed", {})
    })

    expect(result.current.activeSteps).toHaveLength(0)
    expect(result.current.roundProgress).toBeNull()
  })
})
