/**
 * 性能基准 — ReAct 循环 context 构建延迟
 *
 * 测量 ReactContextManager 的 context 构建和压缩性能。
 * 纯内存操作，不依赖外部服务。
 */

import { describe, it, expect } from "vitest"
import {
  ReactContextManager,
  generateToolCallId,
} from "@/lib/workers/react-context"

function buildContext(steps: number): ReactContextManager {
  const ctx = new ReactContextManager("system prompt", "开始测试")
  for (let i = 1; i <= steps; i++) {
    const callId = generateToolCallId()
    ctx.addAssistantMessage(`思考${i}`, { name: "scan", arguments: `{"i":${i}}` }, callId)
    ctx.addToolResult({
      stepIndex: i,
      toolName: "scan",
      target: "target",
      functionName: "scan",
      output: `结果${i}: ${"data".repeat(200)}`,
      status: "succeeded",
      toolCallId: callId,
    })
  }
  return ctx
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((sorted.length * p) / 100) - 1
  return sorted[Math.max(0, idx)]
}

describe("ReAct Loop context 性能基准", () => {
  it("单轮 context 构建 + getMessages — 1000 次 P95 < 1ms", () => {
    const times: number[] = []

    for (let i = 0; i < 1000; i++) {
      const start = performance.now()
      const ctx = new ReactContextManager("sys", "usr")
      const callId = generateToolCallId()
      ctx.addAssistantMessage("think", { name: "scan", arguments: "{}" }, callId)
      ctx.addToolResult({
        stepIndex: 1,
        toolName: "scan",
        target: "t",
        functionName: "scan",
        output: "result",
        status: "succeeded",
        toolCallId: callId,
      })
      ctx.getMessages()
      times.push(performance.now() - start)
    }

    const sorted = [...times].sort((a, b) => a - b)
    const p95 = percentile(sorted, 95)
    const avg = times.reduce((s, t) => s + t, 0) / times.length

    console.log(`[perf] 单轮 context 1000 次:`)
    console.log(`[perf]   平均: ${avg.toFixed(3)}ms`)
    console.log(`[perf]   P95:  ${p95.toFixed(3)}ms`)

    expect(p95).toBeLessThan(1)
  })

  it("5 轮 context 构建 — 500 次 P95 < 5ms", () => {
    const times: number[] = []

    for (let i = 0; i < 500; i++) {
      const start = performance.now()
      buildContext(5)
      times.push(performance.now() - start)
    }

    const sorted = [...times].sort((a, b) => a - b)
    const p95 = percentile(sorted, 95)
    const avg = times.reduce((s, t) => s + t, 0) / times.length

    console.log(`[perf] 5 轮 context 500 次:`)
    console.log(`[perf]   平均: ${avg.toFixed(3)}ms`)
    console.log(`[perf]   P95:  ${p95.toFixed(3)}ms`)

    expect(p95).toBeLessThan(5)
  })

  it("10 轮 context（触发压缩）— 100 次 P95 < 50ms", () => {
    const times: number[] = []

    for (let iter = 0; iter < 100; iter++) {
      const start = performance.now()
      const ctx = new ReactContextManager("sys", "usr")
      for (let i = 1; i <= 10; i++) {
        const callId = generateToolCallId()
        ctx.addAssistantMessage(`t${i}`, { name: "s", arguments: "{}" }, callId)
        ctx.addToolResult({
          stepIndex: i,
          toolName: "s",
          target: "t",
          functionName: "s",
          output: "x".repeat(30000), // 大输出触发压缩
          status: "succeeded",
          toolCallId: callId,
        })
      }
      ctx.getMessages()
      times.push(performance.now() - start)
    }

    const sorted = [...times].sort((a, b) => a - b)
    const p95 = percentile(sorted, 95)
    const avg = times.reduce((s, t) => s + t, 0) / times.length

    console.log(`[perf] 10 轮 context（压缩）100 次:`)
    console.log(`[perf]   平均: ${avg.toFixed(3)}ms`)
    console.log(`[perf]   P95:  ${p95.toFixed(3)}ms`)

    expect(p95).toBeLessThan(50)
  })
})
