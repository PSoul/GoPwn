/**
 * 集成测试：mcp-run-repo
 * 使用 PGlite 验证 MCP 执行记录的状态流转、取消和计数
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { createTestDb, type TestDb } from "../../helpers/pglite-prisma"

vi.mock("@/lib/infra/prisma", () => ({ prisma: null as any }))
// Mock job-queue，checkAndPublishRoundCompletion 内部会动态 import
vi.mock("@/lib/infra/job-queue", () => ({
  createPgBossJobQueue: () => ({
    publish: vi.fn().mockResolvedValue(undefined),
  }),
}))

let db: TestDb

beforeAll(async () => {
  db = await createTestDb()
  const mod = await import("@/lib/infra/prisma")
  ;(mod as any).prisma = db.prisma
}, 30_000)

afterAll(async () => {
  await db?.cleanup()
})

beforeEach(async () => {
  await db.truncateAll()
})

describe("mcp-run-repo", () => {
  let repo: typeof import("@/lib/repositories/mcp-run-repo")
  let seedProjectId: string

  beforeAll(async () => {
    repo = await import("@/lib/repositories/mcp-run-repo")
  })

  beforeEach(async () => {
    const project = await db.prisma.project.create({
      data: { code: `proj-${Date.now()}`, name: "McpRun 测试项目" },
    })
    seedProjectId = project.id
  })

  describe("create", () => {
    it("应创建 pending 状态的执行记录", async () => {
      const run = await repo.create({
        projectId: seedProjectId,
        capability: "port_scanning",
        toolName: "fscan_port_scan",
        target: "127.0.0.1",
        requestedAction: "扫描端口",
        riskLevel: "low",
        phase: "recon",
        round: 1,
      })

      expect(run.id).toBeDefined()
      expect(run.status).toBe("pending")
      expect(run.round).toBe(1)
    })

    it("应支持 ReAct 字段", async () => {
      const run = await repo.create({
        projectId: seedProjectId,
        capability: "port_scanning",
        toolName: "fscan",
        target: "10.0.0.1",
        requestedAction: "扫描",
        riskLevel: "low",
        phase: "recon",
        round: 1,
        stepIndex: 0,
        thought: "先扫描常见端口",
        functionArgs: { target: "10.0.0.1", ports: "1-1000" },
      })

      expect(run.stepIndex).toBe(0)
      expect(run.thought).toBe("先扫描常见端口")
    })
  })

  describe("findById", () => {
    it("应返回执行记录及关联数据", async () => {
      const created = await repo.create({
        projectId: seedProjectId,
        capability: "scanning",
        toolName: "tool",
        target: "t",
        requestedAction: "a",
        riskLevel: "low",
        phase: "recon",
        round: 1,
      })

      const found = await repo.findById(created.id)
      expect(found).not.toBeNull()
      expect(found!.id).toBe(created.id)
      expect(found!.evidence).toEqual([])
      expect(found!.pocs).toEqual([])
    })
  })

  describe("updateStatus — 状态流转", () => {
    it("pending → running → succeeded", async () => {
      const run = await repo.create({
        projectId: seedProjectId,
        capability: "scan",
        toolName: "tool",
        target: "t",
        requestedAction: "a",
        riskLevel: "low",
        phase: "recon",
        round: 1,
      })

      const running = await repo.updateStatus(run.id, "running", {
        startedAt: new Date(),
      })
      expect(running.status).toBe("running")

      const succeeded = await repo.updateStatus(run.id, "succeeded", {
        rawOutput: "扫描结果",
        completedAt: new Date(),
      })
      expect(succeeded.status).toBe("succeeded")
      expect(succeeded.rawOutput).toBe("扫描结果")
    })

    it("pending → failed 应记录错误信息", async () => {
      const run = await repo.create({
        projectId: seedProjectId,
        capability: "scan",
        toolName: "tool",
        target: "t",
        requestedAction: "a",
        riskLevel: "low",
        phase: "recon",
        round: 1,
      })

      const failed = await repo.updateStatus(run.id, "failed", {
        error: "连接超时",
        completedAt: new Date(),
      })
      expect(failed.status).toBe("failed")
      expect(failed.error).toBe("连接超时")
    })
  })

  describe("findByProject", () => {
    it("应返回项目所有执行记录", async () => {
      await repo.create({
        projectId: seedProjectId,
        capability: "a",
        toolName: "a",
        target: "t",
        requestedAction: "a",
        riskLevel: "low",
        phase: "recon",
        round: 1,
      })
      await repo.create({
        projectId: seedProjectId,
        capability: "b",
        toolName: "b",
        target: "t",
        requestedAction: "b",
        riskLevel: "medium",
        phase: "recon",
        round: 1,
      })

      const runs = await repo.findByProject(seedProjectId)
      expect(runs).toHaveLength(2)
    })
  })

  describe("findByProjectAndRound", () => {
    it("应按 round 过滤", async () => {
      await repo.create({
        projectId: seedProjectId,
        capability: "a",
        toolName: "a",
        target: "t",
        requestedAction: "a",
        riskLevel: "low",
        phase: "recon",
        round: 1,
      })
      await repo.create({
        projectId: seedProjectId,
        capability: "b",
        toolName: "b",
        target: "t",
        requestedAction: "b",
        riskLevel: "low",
        phase: "discovery",
        round: 2,
      })

      const round1 = await repo.findByProjectAndRound(seedProjectId, 1)
      expect(round1).toHaveLength(1)
      const round2 = await repo.findByProjectAndRound(seedProjectId, 2)
      expect(round2).toHaveLength(1)
    })
  })

  describe("cancelPendingByProject", () => {
    it("应取消所有 pending/scheduled/running 的记录", async () => {
      const r1 = await repo.create({
        projectId: seedProjectId,
        capability: "a",
        toolName: "a",
        target: "t",
        requestedAction: "a",
        riskLevel: "low",
        phase: "recon",
        round: 1,
      })
      const r2 = await repo.create({
        projectId: seedProjectId,
        capability: "b",
        toolName: "b",
        target: "t",
        requestedAction: "b",
        riskLevel: "low",
        phase: "recon",
        round: 1,
      })
      // 将 r2 改为 succeeded，不应被取消
      await repo.updateStatus(r2.id, "succeeded")

      const result = await repo.cancelPendingByProject(seedProjectId)
      expect(result.count).toBe(1) // 只有 r1 (pending) 被取消

      const found = await repo.findById(r1.id)
      expect(found!.status).toBe("cancelled")
    })
  })

  describe("countByProjectAndStatus", () => {
    it("应按状态分组计数", async () => {
      await repo.create({
        projectId: seedProjectId,
        capability: "a",
        toolName: "a",
        target: "t",
        requestedAction: "a",
        riskLevel: "low",
        phase: "recon",
        round: 1,
      })
      const r2 = await repo.create({
        projectId: seedProjectId,
        capability: "b",
        toolName: "b",
        target: "t",
        requestedAction: "b",
        riskLevel: "low",
        phase: "recon",
        round: 1,
      })
      await repo.updateStatus(r2.id, "succeeded")

      const counts = await repo.countByProjectAndStatus(seedProjectId)
      const pendingCount = counts.find((c) => c.status === "pending")
      const succeededCount = counts.find((c) => c.status === "succeeded")
      expect(pendingCount?._count).toBe(1)
      expect(succeededCount?._count).toBe(1)
    })
  })

  describe("countPendingByProject", () => {
    it("应计算非终态记录数", async () => {
      await repo.create({
        projectId: seedProjectId,
        capability: "a",
        toolName: "a",
        target: "t",
        requestedAction: "a",
        riskLevel: "low",
        phase: "recon",
        round: 1,
      })
      const r2 = await repo.create({
        projectId: seedProjectId,
        capability: "b",
        toolName: "b",
        target: "t",
        requestedAction: "b",
        riskLevel: "low",
        phase: "recon",
        round: 1,
      })
      await repo.updateStatus(r2.id, "failed")

      const count = await repo.countPendingByProject(seedProjectId)
      expect(count).toBe(1) // 只有 r1 还在 pending
    })
  })

  describe("updateReactFields", () => {
    it("应更新 thought 和 functionArgs", async () => {
      const run = await repo.create({
        projectId: seedProjectId,
        capability: "scan",
        toolName: "tool",
        target: "t",
        requestedAction: "a",
        riskLevel: "low",
        phase: "recon",
        round: 1,
        stepIndex: 0,
      })

      const updated = await repo.updateReactFields(run.id, {
        thought: "分析结果发现需要深入扫描",
        functionArgs: { target: "10.0.0.1", deep: true },
      })

      expect(updated.thought).toBe("分析结果发现需要深入扫描")
      expect(updated.functionArgs).toEqual({ target: "10.0.0.1", deep: true })
    })
  })
})
