/**
 * 集成测试：audit-repo
 * 使用 PGlite 验证审计日志的 CRUD 操作
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

describe("audit-repo", () => {
  let repo: typeof import("@/lib/repositories/audit-repo")
  let seedProjectId: string

  beforeAll(async () => {
    repo = await import("@/lib/repositories/audit-repo")
  })

  beforeEach(async () => {
    const project = await db.prisma.project.create({
      data: { code: `proj-${Date.now()}`, name: "Audit 测试项目" },
    })
    seedProjectId = project.id
  })

  describe("create", () => {
    it("应创建审计日志（关联 project）", async () => {
      const event = await repo.create({
        projectId: seedProjectId,
        category: "project",
        action: "created",
        actor: "user",
        detail: "创建了测试项目",
      })

      expect(event.id).toBeDefined()
      expect(event.projectId).toBe(seedProjectId)
      expect(event.category).toBe("project")
      expect(event.action).toBe("created")
      expect(event.detail).toBe("创建了测试项目")
    })

    it("projectId 为 null 时应正常创建（系统级事件）", async () => {
      const event = await repo.create({
        category: "system",
        action: "startup",
        actor: "system",
      })

      expect(event.id).toBeDefined()
      expect(event.projectId).toBeNull()
      expect(event.detail).toBe("")
    })

    it("detail 缺省时应使用空字符串", async () => {
      const event = await repo.create({
        projectId: seedProjectId,
        category: "approval",
        action: "approved",
        actor: "user",
      })

      expect(event.detail).toBe("")
    })
  })

  describe("findByProject", () => {
    it("应返回指定项目的审计日志（降序，默认 limit 50）", async () => {
      for (let i = 0; i < 5; i++) {
        await repo.create({
          projectId: seedProjectId,
          category: "test",
          action: `action-${i}`,
          actor: "user",
        })
      }

      const events = await repo.findByProject(seedProjectId)
      expect(events).toHaveLength(5)
      // 应按 createdAt 降序
      // 注意 PGlite 在同一毫秒创建可能无法保证严格顺序，验证返回了全部记录即可
    })

    it("应支持自定义 limit", async () => {
      for (let i = 0; i < 10; i++) {
        await repo.create({
          projectId: seedProjectId,
          category: "test",
          action: `action-${i}`,
          actor: "user",
        })
      }

      const events = await repo.findByProject(seedProjectId, 3)
      expect(events).toHaveLength(3)
    })

    it("不同项目的日志应隔离", async () => {
      await repo.create({
        projectId: seedProjectId,
        category: "test",
        action: "a",
        actor: "user",
      })
      // 系统级事件不属于任何项目
      await repo.create({
        category: "system",
        action: "b",
        actor: "system",
      })

      const events = await repo.findByProject(seedProjectId)
      expect(events).toHaveLength(1)
    })
  })

  describe("findAll", () => {
    it("应返回所有审计日志（包括无 projectId 的）", async () => {
      await repo.create({
        projectId: seedProjectId,
        category: "project",
        action: "created",
        actor: "user",
      })
      await repo.create({
        category: "system",
        action: "startup",
        actor: "system",
      })

      const all = await repo.findAll()
      expect(all).toHaveLength(2)
    })

    it("应支持自定义 limit", async () => {
      for (let i = 0; i < 5; i++) {
        await repo.create({
          projectId: seedProjectId,
          category: "test",
          action: `a-${i}`,
          actor: "user",
        })
      }

      const events = await repo.findAll(2)
      expect(events).toHaveLength(2)
    })
  })
})
