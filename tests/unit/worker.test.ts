/**
 * 单元测试：worker.ts 入口
 * 测试 recoverStaleProjects、fatalShutdown、handler 注册逻辑
 *
 * worker.ts 的函数未导出，且 main() 在 import 时自动执行。
 * 策略：mock 所有外部依赖后一次性 import，在 describe 内检查各副作用。
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest"

// ── vi.hoisted: mock 引用 ──
const mockQueue = vi.hoisted(() => ({
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  publish: vi.fn().mockResolvedValue("job-1"),
  subscribe: vi.fn().mockResolvedValue(undefined),
}))

const mockFindByLifecycles = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const mockUpdateLifecycle = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockFailStaleRunningRuns = vi.hoisted(() => vi.fn().mockResolvedValue(0))
const mockCountPendingByProject = vi.hoisted(() => vi.fn().mockResolvedValue(0))
const mockCloseAll = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

// ── Mock 所有外部依赖 ──
vi.mock("dotenv/config", () => ({}))
vi.mock("node:dns", () => ({ default: { setDefaultResultOrder: vi.fn() } }))

vi.mock("@/lib/infra/job-queue", () => ({
  createPgBossJobQueue: () => mockQueue,
  getBoss: () => ({ on: vi.fn() }),
}))

vi.mock("@/lib/repositories/project-repo", () => ({
  findByLifecycles: mockFindByLifecycles,
  updateLifecycle: mockUpdateLifecycle,
}))

vi.mock("@/lib/repositories/mcp-run-repo", () => ({
  failStaleRunningRuns: mockFailStaleRunningRuns,
  countPendingByProject: mockCountPendingByProject,
}))

vi.mock("@/lib/mcp/registry", () => ({
  closeAll: mockCloseAll,
  syncToolsFromServers: vi.fn().mockResolvedValue({ synced: 0, errors: [] }),
}))

vi.mock("@/lib/repositories/llm-log-repo", () => ({
  cleanupStale: vi.fn().mockResolvedValue({ count: 0 }),
}))

vi.mock("@/lib/services/mcp-bootstrap", () => ({
  bootstrapMcp: vi.fn().mockResolvedValue({
    servers: { loaded: 2, errors: [] },
    tools: { synced: 5, errors: [] },
  }),
}))

vi.mock("@/lib/infra/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}))

vi.mock("@/lib/infra/pipeline-logger", () => ({
  createPipelineLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}))

vi.mock("@/lib/repositories/pipeline-log-repo", () => ({
  cleanupOld: vi.fn().mockResolvedValue(0),
}))

// Prevent process.exit from actually exiting
const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never)

describe("worker.ts", () => {
  // Import worker module once — this triggers main()
  beforeAll(async () => {
    await import("../../worker")
    // Wait for main() async init to finish
    await vi.waitFor(() => {
      expect(mockQueue.subscribe).toHaveBeenCalled()
    }, { timeout: 10000 })
  })

  afterAll(() => {
    exitSpy.mockRestore()
  })

  describe("main() 启动流程", () => {
    it("启动后调用 queue.start()", () => {
      expect(mockQueue.start).toHaveBeenCalled()
    })

    it("注册 5 个 job handler", () => {
      expect(mockQueue.subscribe).toHaveBeenCalledTimes(5)
      const names = mockQueue.subscribe.mock.calls.map((c: unknown[]) => c[0])
      expect(names).toEqual(expect.arrayContaining([
        "react_round",
        "analyze_result",
        "verify_finding",
        "round_completed",
        "settle_closure",
      ]))
    })

    it("react_round handler 使用 localConcurrency: 3", () => {
      const reactCall = mockQueue.subscribe.mock.calls.find((c: unknown[]) => c[0] === "react_round")
      expect(reactCall).toBeDefined()
      expect(reactCall![2]).toEqual(expect.objectContaining({ localConcurrency: 3 }))
    })

    it("analyze_result handler 使用 localConcurrency: 5", () => {
      const analyzeCall = mockQueue.subscribe.mock.calls.find((c: unknown[]) => c[0] === "analyze_result")
      expect(analyzeCall).toBeDefined()
      expect(analyzeCall![2]).toEqual(expect.objectContaining({ localConcurrency: 5 }))
    })
  })

  describe("recoverStaleProjects（通过 init 调用验证）", () => {
    it("findByLifecycles 在启动时被调用", () => {
      // recoverStaleProjects is called once during main() init
      expect(mockFindByLifecycles).toHaveBeenCalledWith(
        expect.arrayContaining(["planning", "executing", "reviewing", "settling", "stopping"]),
      )
    })

    it("无 stale 项目 → publish 未被调用用于恢复", () => {
      // Default mock returns [], so no recovery publishes should have been made
      // (publish may have been called for other reasons, but not for recovery)
      // Since findByLifecycles returned [], updateLifecycle should not be called
      // This validates the empty-case path
      expect(mockUpdateLifecycle).not.toHaveBeenCalled()
    })
  })

  describe("fatalShutdown", () => {
    it("uncaughtException → 调用 closeAll + process.exit(1)", async () => {
      mockCloseAll.mockClear()
      exitSpy.mockClear()

      process.emit("uncaughtException", new Error("boom"))

      await vi.waitFor(() => {
        expect(mockCloseAll).toHaveBeenCalled()
        expect(exitSpy).toHaveBeenCalledWith(1)
      }, { timeout: 3000 })
    })

    it("closeAll 抛异常 → best-effort 不二次崩溃", async () => {
      mockCloseAll.mockClear()
      exitSpy.mockClear()
      mockCloseAll.mockRejectedValueOnce(new Error("cleanup failed"))

      process.emit("uncaughtException", new Error("boom2"))

      await vi.waitFor(() => {
        expect(exitSpy).toHaveBeenCalledWith(1)
      }, { timeout: 3000 })
    })

    it("unhandledRejection → 同样触发 fatalShutdown", async () => {
      mockCloseAll.mockClear()
      exitSpy.mockClear()

      // @ts-expect-error — process.emit typing doesn't match runtime behavior for unhandledRejection
      process.emit("unhandledRejection", new Error("rejected"))

      await vi.waitFor(() => {
        expect(exitSpy).toHaveBeenCalledWith(1)
      }, { timeout: 3000 })
    })
  })
})
