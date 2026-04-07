import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { MockEventSource } from "../../helpers/mock-event-source"
import { useProjectEvents } from "@/lib/hooks/use-project-events"

// 全局替换 EventSource
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

describe("useProjectEvents", () => {
  it("建立 EventSource 连接并在 open 后标记 connected", () => {
    const { result } = renderHook(() => useProjectEvents("p1"))

    expect(MockEventSource.instances).toHaveLength(1)
    expect(latestES().url).toContain("/api/projects/p1/events")
    expect(result.current.connected).toBe(false)

    act(() => {
      latestES().triggerOpen()
    })
    expect(result.current.connected).toBe(true)
  })

  it("接收 SSE 消息后更新 lastEvent", () => {
    const { result } = renderHook(() => useProjectEvents("p1"))

    const event = {
      type: "lifecycle_changed",
      projectId: "p1",
      timestamp: new Date().toISOString(),
      data: {},
    }

    act(() => {
      latestES().triggerMessage(JSON.stringify(event))
    })

    expect(result.current.lastEvent).not.toBeNull()
    expect(result.current.lastEvent!.type).toBe("lifecycle_changed")
  })

  it("触发 onEvent 回调", () => {
    const onEvent = vi.fn()
    renderHook(() => useProjectEvents("p1", onEvent))

    const event = {
      type: "lifecycle_changed",
      projectId: "p1",
      timestamp: new Date().toISOString(),
      data: { status: "running" },
    }

    act(() => {
      latestES().triggerMessage(JSON.stringify(event))
    })

    expect(onEvent).toHaveBeenCalledOnce()
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "lifecycle_changed" }),
    )
  })

  it("JSON 解析错误时不抛异常，lastEvent 不变", () => {
    const { result } = renderHook(() => useProjectEvents("p1"))

    act(() => {
      latestES().triggerMessage("not-json")
    })

    expect(result.current.lastEvent).toBeNull()
  })

  it("断线后 3 秒重连", () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() => useProjectEvents("p1"))
      const firstES = latestES()

      act(() => {
        firstES.triggerOpen()
      })
      expect(result.current.connected).toBe(true)

      // 触发错误 → 断线
      act(() => {
        firstES.triggerError()
      })
      expect(result.current.connected).toBe(false)
      expect(MockEventSource.instances).toHaveLength(1)

      // 3 秒后重连
      act(() => {
        vi.advanceTimersByTime(3000)
      })
      expect(MockEventSource.instances).toHaveLength(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it("projectId 变更时关闭旧连接并建立新连接", () => {
    const { rerender } = renderHook(
      ({ pid }: { pid: string }) => useProjectEvents(pid),
      { initialProps: { pid: "p1" } },
    )

    const firstES = latestES()
    expect(firstES.url).toContain("/api/projects/p1/events")

    rerender({ pid: "p2" })

    expect(firstES.closed).toBe(true)
    expect(MockEventSource.instances).toHaveLength(2)
    expect(latestES().url).toContain("/api/projects/p2/events")
  })

  it("卸载时关闭 EventSource 连接", () => {
    const { unmount } = renderHook(() => useProjectEvents("p1"))
    const es = latestES()

    unmount()

    expect(es.closed).toBe(true)
  })
})
