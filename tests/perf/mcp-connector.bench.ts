/**
 * 性能测试 — MCP 连接器吞吐量基准
 *
 * 测量 JSON-RPC 序列化/反序列化和 PassThrough 流式传输的开销。
 * 纯内存模拟，不依赖外部服务。
 */

import { describe, it, expect } from "vitest"
import { PassThrough } from "stream"

// 模拟 JSON-RPC 请求/响应往返
function simulateRpcRoundtrip(): Promise<void> {
  const stdout = new PassThrough()
  const response = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    result: { content: [{ type: "text", text: "ok" }] },
  })

  return new Promise<void>((resolve) => {
    stdout.on("data", () => resolve())
    stdout.write(response + "\n")
  })
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((sorted.length * p) / 100) - 1
  return sorted[Math.max(0, idx)]
}

describe("MCP Connector 性能基准", () => {
  it("单请求 JSON-RPC 往返 — 1000 次 P95 < 1ms", async () => {
    const times: number[] = []

    for (let i = 0; i < 1000; i++) {
      const start = performance.now()
      await simulateRpcRoundtrip()
      times.push(performance.now() - start)
    }

    const sorted = [...times].sort((a, b) => a - b)
    const p50 = percentile(sorted, 50)
    const p95 = percentile(sorted, 95)
    const avg = times.reduce((s, t) => s + t, 0) / times.length

    console.log(`[perf] JSON-RPC 往返 1000 次:`)
    console.log(`[perf]   平均: ${avg.toFixed(3)}ms`)
    console.log(`[perf]   P50:  ${p50.toFixed(3)}ms`)
    console.log(`[perf]   P95:  ${p95.toFixed(3)}ms`)

    expect(p95).toBeLessThan(1)
  })

  it("并发 10 请求吞吐 — 100 批 P95 < 5ms", async () => {
    const times: number[] = []

    for (let batch = 0; batch < 100; batch++) {
      const start = performance.now()
      await Promise.all(
        Array.from({ length: 10 }, () => simulateRpcRoundtrip()),
      )
      times.push(performance.now() - start)
    }

    const sorted = [...times].sort((a, b) => a - b)
    const p95 = percentile(sorted, 95)
    const avg = times.reduce((s, t) => s + t, 0) / times.length

    console.log(`[perf] 并发 10 请求 100 批:`)
    console.log(`[perf]   平均: ${avg.toFixed(3)}ms`)
    console.log(`[perf]   P95:  ${p95.toFixed(3)}ms`)

    expect(p95).toBeLessThan(5)
  })

  it("JSON 序列化/反序列化 — 10000 次 < 200ms", () => {
    const obj = {
      jsonrpc: "2.0",
      id: 1,
      result: {
        content: [{ type: "text", text: "scan result ".repeat(50) }],
      },
    }

    const start = performance.now()
    for (let i = 0; i < 10000; i++) {
      const str = JSON.stringify(obj)
      JSON.parse(str)
    }
    const elapsed = performance.now() - start

    console.log(
      `[perf] JSON 序列化+反序列化 10000 次: ${elapsed.toFixed(1)}ms`,
    )

    expect(elapsed).toBeLessThan(200)
  })
})
