/**
 * 集成测试：approval-service
 * 使用 PGlite 做真实数据库，验证审批决策逻辑和 TOCTOU 并发安全
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { createTestDb, type TestDb } from "../../helpers/pglite-prisma"

// Mock prisma 模块
vi.mock("@/lib/infra/prisma", () => ({ prisma: null as any }))

// Mock 外部基础设施
vi.mock("@/lib/infra/event-bus", () => ({
  publishEvent: vi.fn().mockResolvedValue(undefined),
}))
// Mock job-queue（mcp-run-repo updateStatus 内部的 checkAndPublishRoundCompletion 需要）
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
  vi.clearAllMocks()
})

describe("approval-service", () => {
  let service: typeof import("@/lib/services/approval-service")
  let seedProjectId: string
  let seedMcpRunId: string

  beforeAll(async () => {
    service = await import("@/lib/services/approval-service")
  })

  // seed: project(executing) → mcpRun → approval
  beforeEach(async () => {
    const project = await db.prisma.project.create({
      data: {
        code: `proj-${Date.now()}`,
        name: "Approval Service 测试",
        lifecycle: "waiting_approval",
      },
    })
    seedProjectId = project.id

    const mcpRun = await db.prisma.mcpRun.create({
      data: {
        projectId: seedProjectId,
        capability: "port_scanning",
        toolName: "fscan_port_scan",
        target: "127.0.0.1",
        requestedAction: "扫描端口",
        riskLevel: "medium",
        phase: "recon",
        round: 1,
        status: "pending",
      },
    })
    seedMcpRunId = mcpRun.id
  })

  /** 辅助：创建一个 pending approval */
  async function createPendingApproval(mcpRunId?: string) {
    const runId = mcpRunId ?? seedMcpRunId
    return db.prisma.approval.create({
      data: {
        projectId: seedProjectId,
        mcpRunId: runId,
        target: "127.0.0.1",
        actionType: "port_scan",
        riskLevel: "medium",
        status: "pending",
      },
    })
  }

  describe("listByProject", () => {
    it("应返回项目所有审批", async () => {
      await createPendingApproval()

      const approvals = await service.listByProject(seedProjectId)
      expect(approvals).toHaveLength(1)
    })
  })

  describe("decide", () => {
    it("approved 应更新审批状态并将 mcpRun 设为 scheduled", async () => {
      const approval = await createPendingApproval()

      const result = await service.decide(approval.id, "approved", "同意")
      expect(result.status).toBe("approved")

      // 验证 mcpRun 状态变为 scheduled
      const run = await db.prisma.mcpRun.findUnique({ where: { id: seedMcpRunId } })
      expect(run!.status).toBe("scheduled")

      // 验证审计日志
      const audits = await db.prisma.auditEvent.findMany({
        where: { projectId: seedProjectId, category: "approval" },
      })
      expect(audits).toHaveLength(1)
      expect(audits[0].action).toBe("approved")
    })

    it("rejected 应将 mcpRun 设为 cancelled", async () => {
      const approval = await createPendingApproval()

      const result = await service.decide(approval.id, "rejected", "风险过高")
      expect(result.status).toBe("rejected")

      const run = await db.prisma.mcpRun.findUnique({ where: { id: seedMcpRunId } })
      expect(run!.status).toBe("cancelled")
    })

    it("不存在的审批应抛出 NotFoundError", async () => {
      await expect(service.decide("nonexistent", "approved")).rejects.toThrow("not found")
    })

    it("已决策的审批应抛出 DomainError (ALREADY_RESOLVED)", async () => {
      const approval = await createPendingApproval()
      await service.decide(approval.id, "approved")

      await expect(service.decide(approval.id, "rejected")).rejects.toThrow("already resolved")
    })

    it("所有 pending 审批都决策后应将项目从 waiting_approval 转回 executing", async () => {
      const approval = await createPendingApproval()

      await service.decide(approval.id, "approved")

      // 验证项目状态转回 executing
      const project = await db.prisma.project.findUnique({ where: { id: seedProjectId } })
      expect(project!.lifecycle).toBe("executing")
    })

    it("还有未决审批时不应改变项目状态", async () => {
      // 创建两个 mcpRun 和对应的 approval
      const extraRun = await db.prisma.mcpRun.create({
        data: {
          projectId: seedProjectId,
          capability: "http",
          toolName: "curl",
          target: "127.0.0.1",
          requestedAction: "HTTP 请求",
          riskLevel: "low",
          phase: "recon",
          round: 1,
          status: "pending",
        },
      })

      const a1 = await createPendingApproval(seedMcpRunId)
      const a2 = await createPendingApproval(extraRun.id)

      // 只决策第一个
      await service.decide(a1.id, "approved")

      // 项目应仍在 waiting_approval
      const project = await db.prisma.project.findUnique({ where: { id: seedProjectId } })
      expect(project!.lifecycle).toBe("waiting_approval")

      // 决策第二个后应转回
      await service.decide(a2.id, "approved")
      const project2 = await db.prisma.project.findUnique({ where: { id: seedProjectId } })
      expect(project2!.lifecycle).toBe("executing")
    })
  })

  describe("TOCTOU 并发验证", () => {
    it("两个并发 decide 只有一个应成功，另一个抛出 ALREADY_RESOLVED", async () => {
      const approval = await createPendingApproval()

      // 并发发起两个决策
      const results = await Promise.allSettled([
        service.decide(approval.id, "approved", "并发-1"),
        service.decide(approval.id, "rejected", "并发-2"),
      ])

      // 应恰好一个成功、一个失败
      const fulfilled = results.filter((r) => r.status === "fulfilled")
      const rejected = results.filter((r) => r.status === "rejected")

      expect(fulfilled).toHaveLength(1)
      expect(rejected).toHaveLength(1)

      // 失败的应是 ALREADY_RESOLVED
      const error = (rejected[0] as PromiseRejectedResult).reason
      expect(error.message).toMatch(/already resolved/i)
    })
  })
})
