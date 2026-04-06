# Plan 4: 性能测试

> 前置: Plan 1 (mock-llm.ts, vitest.perf.config.mts)
> 产出: 3 个性能测试场景，约 10 个用例
> 验证: `npm run test:perf` 全绿

## Step 1: 完善 mock-llm.ts

在 Plan 1 中已创建基本框架，这里补充性能测试专用的延迟 mock。

`createDelayedLlmProvider`:
- 内部维护调用计数器
- 每次 chat() 等待 delayMs 后返回 responses 中的下一个预设响应
- failRate > 0 时按概率抛错
- 支持 abort signal（被 abort 时立即 reject）

`createDelayedMcpTool`:
- 等待 delayMs 后返回 output
- 支持 failRate
- 返回格式: `{ content: string, isError: boolean }`

`createSequentialLlmProvider`:
- 按顺序返回预设的 LlmResponse 数组
- 用完后循环最后一个
- 用于模拟多步 ReAct 循环（先返回几个 function_call，最后返回 final answer）

## Step 2: react-loop.perf.ts — 单轮 ReAct 吞吐量

文件: `tests/perf/react-loop.perf.ts`
源文件: `lib/workers/react-worker.ts`

Mock:
- LLM: createDelayedLlmProvider(50ms)，预设 3 个 function_call + 1 个 final answer
- MCP: createDelayedMcpTool(100ms)
- Repositories: 全部 vi.mock，返回合理默认值
- job-queue: mock publish
- event-bus: mock publishEvent

测试:
```
describe("ReAct loop throughput", () => {
  it("单轮 3-step ReAct 框架开销 < 500ms", async () => {
    // 预期: 3 × (50ms LLM + 100ms MCP) + 1 × 50ms final = 500ms mock 延迟
    // 框架开销 = 实际耗时 - 500ms
    const start = performance.now()
    await handleReactRound({ projectId, round: 1 })
    const elapsed = performance.now() - start
    const overhead = elapsed - 500
    expect(overhead).toBeLessThan(500)
    console.log(`[perf] ReAct 3-step: ${elapsed.toFixed(0)}ms (overhead: ${overhead.toFixed(0)}ms)`)
  })

  it("连续 10 轮 P95 < 1200ms", async () => {
    const times: number[] = []
    for (let i = 0; i < 10; i++) {
      const start = performance.now()
      await handleReactRound({ projectId, round: i + 1 })
      times.push(performance.now() - start)
    }
    times.sort((a, b) => a - b)
    const p50 = times[4]
    const p95 = times[9]
    console.log(`[perf] P50: ${p50.toFixed(0)}ms, P95: ${p95.toFixed(0)}ms`)
    expect(p95).toBeLessThan(1200)
  })
})
```

## Step 3: concurrent-projects.perf.ts — 并发隔离性

文件: `tests/perf/concurrent-projects.perf.ts`

Mock: 同 Step 2，但为每个项目使用不同的 projectId 和 mock 数据。

需要特殊处理: abort-registry 是进程内全局状态，需确认多个项目的 AbortController 互不干扰。

测试:
```
describe("concurrent project isolation", () => {
  it("5 个并发项目全部完成", async () => {
    const projects = ["p1", "p2", "p3", "p4", "p5"]
    const results = await Promise.all(
      projects.map(pid => handleReactRound({ projectId: pid, round: 1 }))
    )
    // 每个都应正常完成，无抛错
    expect(results).toHaveLength(5)
  })

  it("5 并发 vs 5 串行耗时比 < 2x", async () => {
    // 串行
    const serialStart = performance.now()
    for (let i = 0; i < 5; i++) {
      await handleReactRound({ projectId: `serial-${i}`, round: 1 })
    }
    const serialTime = performance.now() - serialStart

    // 并发
    const concurrentStart = performance.now()
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        handleReactRound({ projectId: `concurrent-${i}`, round: 1 })
      )
    )
    const concurrentTime = performance.now() - concurrentStart

    const ratio = concurrentTime / serialTime
    console.log(`[perf] serial: ${serialTime.toFixed(0)}ms, concurrent: ${concurrentTime.toFixed(0)}ms, ratio: ${ratio.toFixed(2)}`)
    expect(ratio).toBeLessThan(2)
  })

  it("abort 一个项目不影响其他", async () => {
    const controller = new AbortController()
    const projects = [
      handleReactRound({ projectId: "abort-target", round: 1 }), // 将被 abort
      handleReactRound({ projectId: "survivor-1", round: 1 }),
      handleReactRound({ projectId: "survivor-2", round: 1 }),
    ]

    // 50ms 后 abort 第一个
    setTimeout(() => {
      // 通过 abort-registry 取消
      abortAllForProject("abort-target")
    }, 50)

    const results = await Promise.allSettled(projects)
    // abort-target 可能 rejected 或 resolved with aborted status
    // survivor-1 和 survivor-2 必须 fulfilled
    expect(results[1].status).toBe("fulfilled")
    expect(results[2].status).toBe("fulfilled")
  })
})
```

## Step 4: job-queue.perf.ts — pg-boss 压测

文件: `tests/perf/job-queue.perf.ts`

这个测试需要真实 pg-boss 实例（它依赖 PostgreSQL）。两种方案:

**方案 A（推荐）**: 用 PGlite + pg-boss。pg-boss 支持传入自定义 pg pool，如果 PGlite 的 pg 兼容层够用，可以直接用。

**方案 B（fallback）**: 如果 pg-boss 不兼容 PGlite，mock pg-boss 的 publish/subscribe，只测框架层的调度逻辑和 singletonKey 去重。

测试:
```
describe("job queue throughput", () => {
  it("100 个 job 发布 < 2s", async () => {
    const start = performance.now()
    for (let i = 0; i < 100; i++) {
      await queue.publish("test_job", { index: i }, {
        singletonKey: `test-${i}`,
      })
    }
    const elapsed = performance.now() - start
    console.log(`[perf] 100 job publish: ${elapsed.toFixed(0)}ms`)
    expect(elapsed).toBeLessThan(2000)
  })

  it("singletonKey 去重: 重复 key 不创建新 job", async () => {
    await queue.publish("dedup_test", { v: 1 }, { singletonKey: "same-key" })
    await queue.publish("dedup_test", { v: 2 }, { singletonKey: "same-key" })
    // 验证只有 1 个 job 被消费
  })

  it("cancelByProject < 1s for 50 pending jobs", async () => {
    for (let i = 0; i < 50; i++) {
      await queue.publish("cancel_test", { projectId: "p1", index: i })
    }
    const start = performance.now()
    const cancelled = await queue.cancelByProject("p1")
    const elapsed = performance.now() - start
    console.log(`[perf] cancel 50 jobs: ${elapsed.toFixed(0)}ms, cancelled: ${cancelled}`)
    expect(elapsed).toBeLessThan(1000)
  })
})
```

如果 PGlite + pg-boss 不兼容，降级为 mock 版本测试，只验证框架层逻辑。

## Step 5: 验证

```bash
npm run test:perf
```

所有用例通过。性能数据打印到控制台供参考。
