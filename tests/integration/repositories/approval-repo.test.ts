/**
 * 集成测试：approval-repo
 * 使用 PGlite 验证审批的 CRUD、原子性决策、取消等操作
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { createTestDb, type TestDb } from "../../helpers/pglite-prisma"

vi.mock("@/lib/infra/prisma", () => ({ prisma: null as any }))

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

describe("approval-repo", () => {
  let repo: typeof import("@/lib/repositories/approval-repo")
  let seedProjectId: string
  let seedMcpRunId: string

  beforeAll(async () => {
    repo = await import("@/lib/repositories/approval-repo")
  })

  // seed: project → mcpRun（approval 需要 projectId + mcpRunId FK）
  beforeEach(async () => {
    const project = await db.prisma.project.create({
      data: { code: `proj-${Date.now()}`, name: "Approval 测试项目" },
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
      },
    })
    seedMcpRunId = mcpRun.id
  })

  /** 辅助函数：创建额外 mcpRun（因 approval.mcpRunId 是 @unique） */
  async function createExtraMcpRun() {
    const run = await db.prisma.mcpRun.create({
      data: {
        projectId: seedProjectId,
        capability: "http_request",
        toolName: "curl_http",
        target: "127.0.0.1",
        requestedAction: "HTTP 请求",
        riskLevel: "low",
        phase: "recon",
        round: 1,
      },
    })
    return run.id
  }

  describe("create", () => {
    it("应创建 pending 状态的审批", async () => {
      const approval = await repo.create({
        projectId: seedProjectId,
        mcpRunId: seedMcpRunId,
        target: "127.0.0.1",
        actionType: "port_scan",
        riskLevel: "medium",
        rationale: "需要扫描目标端口",
      })

      expect(approval.id).toBeDefined()
      expect(approval.status).toBe("pending")
      expect(approval.decidedAt).toBeNull()
    })
  })

  describe("findById", () => {
    it("应返回审批及关联 mcpRun", async () => {
      const created = await repo.create({
        projectId: seedProjectId,
        mcpRunId: seedMcpRunId,
        target: "127.0.0.1",
        actionType: "port_scan",
        riskLevel: "medium",
      })

      const found = await repo.findById(created.id)
      expect(found).not.toBeNull()
      expect(found!.mcpRun).toBeDefined()
      expect(found!.mcpRun.toolName).toBe("fscan_port_scan")
    })
  })

  describe("findByProject", () => {
    it("应返回项目所有审批（降序）", async () => {
      await repo.create({
        projectId: seedProjectId,
        mcpRunId: seedMcpRunId,
        target: "127.0.0.1",
        actionType: "scan_a",
        riskLevel: "low",
      })
      const extraRunId = await createExtraMcpRun()
      await repo.create({
        projectId: seedProjectId,
        mcpRunId: extraRunId,
        target: "127.0.0.1",
        actionType: "scan_b",
        riskLevel: "high",
      })

      const all = await repo.findByProject(seedProjectId)
      expect(all).toHaveLength(2)
    })
  })

  describe("decide — 原子性验证", () => {
    it("pending → approved 应返回 count=1", async () => {
      const approval = await repo.create({
        projectId: seedProjectId,
        mcpRunId: seedMcpRunId,
        target: "127.0.0.1",
        actionType: "port_scan",
        riskLevel: "medium",
      })

      const count = await repo.decide(approval.id, "approved", "同意执行")
      expect(count).toBe(1)

      // 验证数据库中的状态
      const found = await repo.findById(approval.id)
      expect(found!.status).toBe("approved")
      expect(found!.decidedAt).not.toBeNull()
      expect(found!.decisionNote).toBe("同意执行")
    })

    it("已 approved 再 decide 应返回 count=0（幂等安全）", async () => {
      const approval = await repo.create({
        projectId: seedProjectId,
        mcpRunId: seedMcpRunId,
        target: "127.0.0.1",
        actionType: "port_scan",
        riskLevel: "medium",
      })

      // 第一次决策
      await repo.decide(approval.id, "approved")
      // 第二次决策 — 应失败（已非 pending）
      const count = await repo.decide(approval.id, "rejected")
      expect(count).toBe(0)

      // 状态应仍为 approved
      const found = await repo.findById(approval.id)
      expect(found!.status).toBe("approved")
    })
  })

  describe("findPending", () => {
    it("应只返回 pending 状态的审批", async () => {
      const a1 = await repo.create({
        projectId: seedProjectId,
        mcpRunId: seedMcpRunId,
        target: "127.0.0.1",
        actionType: "scan",
        riskLevel: "low",
      })
      const extraRunId = await createExtraMcpRun()
      await repo.create({
        projectId: seedProjectId,
        mcpRunId: extraRunId,
        target: "127.0.0.1",
        actionType: "exploit",
        riskLevel: "high",
      })

      // 批准第一个
      await repo.decide(a1.id, "approved")

      const pending = await repo.findPending(seedProjectId)
      expect(pending).toHaveLength(1)
      expect(pending[0].actionType).toBe("exploit")
    })
  })

  describe("cancelPendingByProject", () => {
    it("应将所有 pending 审批批量设为 rejected", async () => {
      await repo.create({
        projectId: seedProjectId,
        mcpRunId: seedMcpRunId,
        target: "127.0.0.1",
        actionType: "scan",
        riskLevel: "low",
      })
      const extraRunId = await createExtraMcpRun()
      await repo.create({
        projectId: seedProjectId,
        mcpRunId: extraRunId,
        target: "127.0.0.1",
        actionType: "exploit",
        riskLevel: "high",
      })

      const result = await repo.cancelPendingByProject(seedProjectId)
      expect(result.count).toBe(2)

      const pending = await repo.findPending(seedProjectId)
      expect(pending).toHaveLength(0)
    })

    it("已决策的审批不受取消影响", async () => {
      const a1 = await repo.create({
        projectId: seedProjectId,
        mcpRunId: seedMcpRunId,
        target: "127.0.0.1",
        actionType: "scan",
        riskLevel: "low",
      })
      await repo.decide(a1.id, "approved")

      const result = await repo.cancelPendingByProject(seedProjectId)
      expect(result.count).toBe(0)

      // 原来 approved 的应保持不变
      const found = await repo.findById(a1.id)
      expect(found!.status).toBe("approved")
    })
  })
})
