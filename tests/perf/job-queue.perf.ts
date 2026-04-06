/**
 * 性能测试 — job-queue 包装层逻辑
 *
 * 由于 pg-boss 依赖真实 PostgreSQL，这里 mock pg-boss 实例，
 * 测试 createPgBossJobQueue 包装层的调度逻辑和参数传递。
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mock pg-boss 实例 ──
const mockBossSend = vi.hoisted(() => vi.fn())
const mockBossStart = vi.hoisted(() => vi.fn())
const mockBossStop = vi.hoisted(() => vi.fn())
const mockBossWork = vi.hoisted(() => vi.fn())
const mockBossCreateQueue = vi.hoisted(() => vi.fn())

vi.mock("pg-boss", () => {
  return {
    PgBoss: vi.fn().mockImplementation(() => ({
      start: mockBossStart.mockResolvedValue(undefined),
      stop: mockBossStop.mockResolvedValue(undefined),
      send: mockBossSend.mockResolvedValue("job-id-001"),
      work: mockBossWork.mockResolvedValue(undefined),
      createQueue: mockBossCreateQueue.mockResolvedValue(undefined),
    })),
  }
})

// ── Mock prisma（cancelByProject 需要） ──
const mockExecuteRawUnsafe = vi.hoisted(() => vi.fn())
vi.mock("@/lib/infra/prisma", () => ({
  prisma: {
    $executeRawUnsafe: mockExecuteRawUnsafe.mockResolvedValue(3),
  },
}))

import { createPgBossJobQueue } from "@/lib/infra/job-queue"

describe("job-queue 性能测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("100 次 publish 调用 < 500ms", async () => {
    const queue = createPgBossJobQueue()

    const start = performance.now()
    const promises: Promise<string | null>[] = []
    for (let i = 0; i < 100; i++) {
      promises.push(
        queue.publish("test_job", { projectId: `proj-${i}`, data: `payload-${i}` }),
      )
    }
    await Promise.all(promises)
    const elapsed = performance.now() - start

    console.log(`[perf] 100 次 publish 耗时: ${elapsed.toFixed(1)}ms`)
    console.log(`[perf] 平均每次: ${(elapsed / 100).toFixed(2)}ms`)

    // mock 下 100 次异步调用应该很快（框架开销）
    // 宽松阈值：500ms（避免 CI 环境慢机器偶发失败）
    expect(elapsed).toBeLessThan(500)
  })

  it("cancelByProject 正确调用底层 API", async () => {
    const queue = createPgBossJobQueue()

    const result = await queue.cancelByProject("proj-cancel-001")

    // 验证底层 SQL 调用
    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(1)
    expect(mockExecuteRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM pgboss.job"),
      "proj-cancel-001",
    )

    // 返回值应为删除的行数
    expect(result).toBe(3)
  })

  it("singletonKey 正确传递", async () => {
    const queue = createPgBossJobQueue()

    await queue.publish(
      "round_completed",
      { projectId: "proj-sk-001", round: 1 },
      { singletonKey: "round-complete-proj-sk-001-1" },
    )

    // 验证 boss.send 被调用，且 singletonKey 被传递
    expect(mockBossSend).toHaveBeenCalledWith(
      "round_completed",
      { projectId: "proj-sk-001", round: 1 },
      expect.objectContaining({
        singletonKey: "round-complete-proj-sk-001-1",
      }),
    )
  })

  it("publish 默认参数正确", async () => {
    const queue = createPgBossJobQueue()

    await queue.publish("analyze_result", { projectId: "proj-def-001" })

    // 验证默认值传递
    expect(mockBossSend).toHaveBeenCalledWith(
      "analyze_result",
      { projectId: "proj-def-001" },
      expect.objectContaining({
        retryLimit: 3,
        retryDelay: 5,
        expireInSeconds: 600,
        singletonKey: undefined,
      }),
    )
  })

  it("批量 publish 不同 jobName 隔离正确", async () => {
    const queue = createPgBossJobQueue()

    const jobNames = ["react_round", "analyze_result", "round_completed", "review_round"]
    await Promise.all(
      jobNames.map((name) => queue.publish(name, { projectId: "proj-batch-001" })),
    )

    // 每种 jobName 都应调用 createQueue + send
    expect(mockBossCreateQueue).toHaveBeenCalledTimes(jobNames.length)
    expect(mockBossSend).toHaveBeenCalledTimes(jobNames.length)

    // 验证每个 jobName 都被正确传递
    for (const name of jobNames) {
      expect(mockBossSend).toHaveBeenCalledWith(
        name,
        expect.objectContaining({ projectId: "proj-batch-001" }),
        expect.any(Object),
      )
    }
  })
})
