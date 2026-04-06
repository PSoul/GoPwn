/**
 * 集成测试：finding-repo
 * 使用 PGlite 内存数据库验证 finding 的 CRUD、去重、状态更新和 PoC 创建
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

describe("finding-repo", () => {
  let repo: typeof import("@/lib/repositories/finding-repo")
  let seedProjectId: string

  beforeAll(async () => {
    repo = await import("@/lib/repositories/finding-repo")
  })

  // 每次测试前 seed 一个项目（finding 需要 projectId FK）
  beforeEach(async () => {
    const project = await db.prisma.project.create({
      data: { code: `proj-${Date.now()}`, name: "Finding 测试项目" },
    })
    seedProjectId = project.id
  })

  describe("create", () => {
    it("应创建新的 finding", async () => {
      const finding = await repo.create({
        projectId: seedProjectId,
        severity: "high",
        title: "SQL Injection",
        summary: "登录表单存在 SQL 注入",
        affectedTarget: "http://target.com/login",
        recommendation: "使用参数化查询",
      })

      expect(finding.id).toBeDefined()
      expect(finding.title).toBe("SQL Injection")
      expect(finding.severity).toBe("high")
      expect(finding.status).toBe("suspected")
    })

    it("精确重复应更新而非创建新记录", async () => {
      // 第一次创建
      const first = await repo.create({
        projectId: seedProjectId,
        severity: "low",
        title: "SQL Injection",
        affectedTarget: "http://target.com/login",
      })

      // 相同 title + affectedTarget，severity 更高 → 应升级
      const second = await repo.create({
        projectId: seedProjectId,
        severity: "high",
        title: "SQL Injection",
        affectedTarget: "http://target.com/login",
      })

      expect(second.id).toBe(first.id)
      expect(second.severity).toBe("high") // 升级到 high
    })

    it("重复但 severity 更低时不降级", async () => {
      await repo.create({
        projectId: seedProjectId,
        severity: "critical",
        title: "XSS",
        affectedTarget: "http://target.com/search",
      })

      const second = await repo.create({
        projectId: seedProjectId,
        severity: "low",
        title: "XSS",
        affectedTarget: "http://target.com/search",
      })

      expect(second.severity).toBe("critical") // 保持 critical
    })

    it("normalizeTitle 跨语言去重（中英文同义）", async () => {
      const first = await repo.create({
        projectId: seedProjectId,
        severity: "medium",
        title: "SQL 注入",
        affectedTarget: "http://target.com/api",
      })

      // 英文等价标题 + 相同 root host → 应命中去重
      const second = await repo.create({
        projectId: seedProjectId,
        severity: "high",
        title: "SQL Injection",
        affectedTarget: "http://target.com/api/v2",
      })

      expect(second.id).toBe(first.id)
      expect(second.severity).toBe("high") // 升级
    })
  })

  describe("findByProject", () => {
    it("应返回指定项目的所有 findings", async () => {
      await repo.create({ projectId: seedProjectId, severity: "high", title: "Bug A" })
      await repo.create({ projectId: seedProjectId, severity: "low", title: "Bug B" })

      const findings = await repo.findByProject(seedProjectId)
      expect(findings).toHaveLength(2)
    })
  })

  describe("findById", () => {
    it("应返回 finding 及关联数据", async () => {
      const created = await repo.create({
        projectId: seedProjectId,
        severity: "medium",
        title: "Test Finding",
      })

      const found = await repo.findById(created.id)
      expect(found).not.toBeNull()
      expect(found!.id).toBe(created.id)
      expect(found!.pocs).toEqual([])
    })
  })

  describe("findSuspected", () => {
    it("应只返回 suspected 状态的 findings", async () => {
      const f1 = await repo.create({ projectId: seedProjectId, severity: "high", title: "Suspected" })
      const f2 = await repo.create({ projectId: seedProjectId, severity: "low", title: "To Verify" })
      await repo.updateStatus(f2.id, "verified")

      const suspected = await repo.findSuspected(seedProjectId)
      expect(suspected).toHaveLength(1)
      expect(suspected[0].id).toBe(f1.id)
    })
  })

  describe("updateStatus", () => {
    it("应更新 finding 状态", async () => {
      const finding = await repo.create({
        projectId: seedProjectId,
        severity: "high",
        title: "Status Test",
      })

      const updated = await repo.updateStatus(finding.id, "verified")
      expect(updated.status).toBe("verified")
    })
  })

  describe("createPoc", () => {
    it("应为 finding 创建 PoC", async () => {
      const finding = await repo.create({
        projectId: seedProjectId,
        severity: "high",
        title: "PoC Test",
      })

      const poc = await repo.createPoc({
        findingId: finding.id,
        code: "import requests\nr = requests.get('http://target/vuln')",
        language: "python",
        executionOutput: "200 OK",
        succeeded: true,
        executedAt: new Date(),
      })

      expect(poc.id).toBeDefined()
      expect(poc.findingId).toBe(finding.id)
      expect(poc.language).toBe("python")
      expect(poc.succeeded).toBe(true)

      // 验证 findById 包含 pocs
      const found = await repo.findById(finding.id)
      expect(found!.pocs).toHaveLength(1)
    })
  })

  describe("countByProjectAndSeverity", () => {
    it("应按 severity 和 status 分组计数", async () => {
      await repo.create({ projectId: seedProjectId, severity: "high", title: "A" })
      await repo.create({ projectId: seedProjectId, severity: "high", title: "B" })
      await repo.create({ projectId: seedProjectId, severity: "low", title: "C" })

      const counts = await repo.countByProjectAndSeverity(seedProjectId)
      const highCount = counts.find((c) => c.severity === "high" && c.status === "suspected")
      expect(highCount?._count).toBe(2)
    })
  })
})
