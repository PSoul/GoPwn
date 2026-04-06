/**
 * 集成测试：project-repo
 * 使用 PGlite 内存数据库验证项目仓库的 CRUD 及关联操作
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { createTestDb, type TestDb } from "../../helpers/pglite-prisma"

// Mock prisma 模块，让 repo 使用 PGlite 实例
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

describe("project-repo", () => {
  // 延迟导入，确保 mock 已生效
  let repo: typeof import("@/lib/repositories/project-repo")
  beforeAll(async () => {
    repo = await import("@/lib/repositories/project-repo")
  })

  describe("create", () => {
    it("应创建项目并关联 targets", async () => {
      const project = await repo.create({
        code: "proj-001",
        name: "测试项目",
        description: "描述",
        targets: [
          { value: "http://example.com", type: "url", normalized: "http://example.com" },
          { value: "192.168.1.1", type: "ip", normalized: "192.168.1.1" },
        ],
      })

      expect(project.id).toBeDefined()
      expect(project.code).toBe("proj-001")
      expect(project.name).toBe("测试项目")
      expect(project.description).toBe("描述")
      expect(project.lifecycle).toBe("idle")
      expect(project.targets).toHaveLength(2)
      expect(project.targets[0].value).toBe("http://example.com")
    })

    it("应在 description 缺失时使用空字符串", async () => {
      const project = await repo.create({
        code: "proj-002",
        name: "无描述",
        targets: [{ value: "test.com", type: "domain", normalized: "test.com" }],
      })
      expect(project.description).toBe("")
    })
  })

  describe("findById", () => {
    it("应返回项目及 targets 和 rounds", async () => {
      const created = await repo.create({
        code: "proj-003",
        name: "查找测试",
        targets: [{ value: "10.0.0.1", type: "ip", normalized: "10.0.0.1" }],
      })

      const found = await repo.findById(created.id)
      expect(found).not.toBeNull()
      expect(found!.id).toBe(created.id)
      expect(found!.targets).toHaveLength(1)
      expect(found!.rounds).toHaveLength(0)
    })

    it("不存在的 id 应返回 null", async () => {
      const found = await repo.findById("nonexistent-id")
      expect(found).toBeNull()
    })
  })

  describe("findAll", () => {
    it("应返回所有项目（按 updatedAt 降序），包含 _count", async () => {
      await repo.create({
        code: "proj-a",
        name: "项目 A",
        targets: [{ value: "a.com", type: "domain", normalized: "a.com" }],
      })
      await repo.create({
        code: "proj-b",
        name: "项目 B",
        targets: [{ value: "b.com", type: "domain", normalized: "b.com" }],
      })

      const all = await repo.findAll()
      expect(all).toHaveLength(2)
      // 包含 _count 聚合
      expect(all[0]._count).toBeDefined()
      expect(all[0]._count.assets).toBe(0)
      // 包含 targets
      expect(all[0].targets.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe("updateLifecycle", () => {
    it("应更新生命周期状态", async () => {
      const project = await repo.create({
        code: "proj-lc",
        name: "生命周期测试",
        targets: [{ value: "lc.com", type: "domain", normalized: "lc.com" }],
      })

      const updated = await repo.updateLifecycle(project.id, "executing")
      expect(updated.lifecycle).toBe("executing")

      // 再次查询确认持久化
      const found = await repo.findById(project.id)
      expect(found!.lifecycle).toBe("executing")
    })
  })

  describe("updatePhaseAndRound", () => {
    it("应更新阶段和轮次", async () => {
      const project = await repo.create({
        code: "proj-pr",
        name: "阶段测试",
        targets: [{ value: "pr.com", type: "domain", normalized: "pr.com" }],
      })

      const updated = await repo.updatePhaseAndRound(project.id, "discovery", 3)
      expect(updated.currentPhase).toBe("discovery")
      expect(updated.currentRound).toBe(3)
    })
  })

  describe("deleteById", () => {
    it("应删除项目及级联 targets", async () => {
      const project = await repo.create({
        code: "proj-del",
        name: "删除测试",
        targets: [{ value: "del.com", type: "domain", normalized: "del.com" }],
      })

      await repo.deleteById(project.id)

      const found = await repo.findById(project.id)
      expect(found).toBeNull()

      // targets 也应被级联删除
      const targets = await db.prisma.target.findMany({ where: { projectId: project.id } })
      expect(targets).toHaveLength(0)
    })
  })

  describe("findByLifecycles", () => {
    it("应按生命周期过滤项目", async () => {
      const p1 = await repo.create({
        code: "proj-f1",
        name: "空闲",
        targets: [{ value: "f1.com", type: "domain", normalized: "f1.com" }],
      })
      const p2 = await repo.create({
        code: "proj-f2",
        name: "执行中",
        targets: [{ value: "f2.com", type: "domain", normalized: "f2.com" }],
      })
      await repo.updateLifecycle(p2.id, "executing")

      const executing = await repo.findByLifecycles(["executing"])
      expect(executing).toHaveLength(1)
      expect(executing[0].name).toBe("执行中")

      const both = await repo.findByLifecycles(["idle", "executing"])
      expect(both).toHaveLength(2)
    })
  })

  describe("countByLifecycle", () => {
    it("应按生命周期分组计数", async () => {
      await repo.create({
        code: "proj-c1",
        name: "A",
        targets: [{ value: "c1.com", type: "domain", normalized: "c1.com" }],
      })
      const p2 = await repo.create({
        code: "proj-c2",
        name: "B",
        targets: [{ value: "c2.com", type: "domain", normalized: "c2.com" }],
      })
      await repo.updateLifecycle(p2.id, "executing")

      const counts = await repo.countByLifecycle()
      const idleCount = counts.find((c) => c.lifecycle === "idle")
      const execCount = counts.find((c) => c.lifecycle === "executing")
      expect(idleCount?._count).toBe(1)
      expect(execCount?._count).toBe(1)
    })
  })
})
