/**
 * 性能测试 — Job Queue 发布延迟基准
 *
 * 测量 job 数据序列化/反序列化的开销。
 * 纯内存模拟（pg-boss 需要真实数据库，这里只测数据层开销）。
 */

import { describe, it, expect } from "vitest"

// 模拟 job publish 的数据序列化开销
function simulatePublish(jobName: string, data: unknown): string {
  const serialized = JSON.stringify({
    name: jobName,
    data,
    options: { retryLimit: 3, expireInSeconds: 600 },
  })
  JSON.parse(serialized)
  return serialized
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((sorted.length * p) / 100) - 1
  return sorted[Math.max(0, idx)]
}

describe("Job Queue 性能基准", () => {
  it("单次 publish 数据序列化 — 10000 次 < 100ms", () => {
    const start = performance.now()
    for (let i = 0; i < 10000; i++) {
      simulatePublish("react_round", { projectId: "p1", round: 1 })
    }
    const elapsed = performance.now() - start

    console.log(
      `[perf] 单次 publish 序列化 10000 次: ${elapsed.toFixed(1)}ms`,
    )

    expect(elapsed).toBeLessThan(100)
  })

  it("批量 100 次 publish 序列化 — 100 批 P95 合理", () => {
    const times: number[] = []

    for (let batch = 0; batch < 100; batch++) {
      const start = performance.now()
      for (let i = 0; i < 100; i++) {
        simulatePublish("react_round", { projectId: `p${i}`, round: i })
      }
      times.push(performance.now() - start)
    }

    const sorted = [...times].sort((a, b) => a - b)
    const p95 = percentile(sorted, 95)
    const avg = times.reduce((s, t) => s + t, 0) / times.length

    console.log(`[perf] 批量 100 publish 100 批:`)
    console.log(`[perf]   平均: ${avg.toFixed(3)}ms`)
    console.log(`[perf]   P95:  ${p95.toFixed(3)}ms`)

    expect(p95).toBeLessThan(10)
  })

  it("publish + fetch 数据往返 — 数据完整性验证", () => {
    const data = {
      projectId: "p1",
      round: 5,
      metadata: {
        tools: ["nmap", "zap"],
        target: "192.168.1.0/24",
      },
    }

    const iterations = 10000
    const start = performance.now()
    for (let i = 0; i < iterations; i++) {
      const wire = JSON.stringify(data)
      const restored = JSON.parse(wire)
      if (restored.projectId !== "p1") throw new Error("数据损坏")
    }
    const elapsed = performance.now() - start

    console.log(
      `[perf] publish+fetch 往返 ${iterations} 次: ${elapsed.toFixed(1)}ms`,
    )

    expect(elapsed).toBeLessThan(100)
  })
})
