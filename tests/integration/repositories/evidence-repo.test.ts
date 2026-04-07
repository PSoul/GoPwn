/**
 * 集成测试：evidence-repo
 * 使用 PGlite 验证证据 CRUD 操作
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

/** 辅助：创建项目 */
async function createProject(name: string = "test") {
  return db.prisma.project.create({
    data: {
      code: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      updatedAt: new Date(),
    },
  })
}

describe("evidence-repo", () => {
  let repo: typeof import("@/lib/repositories/evidence-repo")

  beforeAll(async () => {
    repo = await import("@/lib/repositories/evidence-repo")
  })

  it("create + findByProject", async () => {
    const project = await createProject()
    await repo.create({
      projectId: project.id,
      title: "XSS",
      toolName: "zap",
      rawOutput: "<script>alert(1)</script>",
    })
    const list = await repo.findByProject(project.id)
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe("XSS")
    expect(list[0].toolName).toBe("zap")
  })

  it("findByProject — 空项目返回空数组", async () => {
    const list = await repo.findByProject("nonexistent-id")
    expect(list).toEqual([])
  })

  it("create — 带可选字段", async () => {
    const project = await createProject("t2")
    const ev = await repo.create({
      projectId: project.id,
      title: "SQLi",
      toolName: "sqlmap",
      rawOutput: "injected",
      summary: "SQL注入漏洞",
      artifactPaths: ["/tmp/dump.txt"],
      capturedUrl: "http://target.com/login",
    })
    expect(ev.summary).toBe("SQL注入漏洞")
    expect(ev.artifactPaths).toContain("/tmp/dump.txt")
    expect(ev.capturedUrl).toBe("http://target.com/login")
  })

  it("create — 不带可选字段时使用默认值", async () => {
    const project = await createProject("t3")
    const ev = await repo.create({
      projectId: project.id,
      title: "Info",
      toolName: "nmap",
      rawOutput: "port 80 open",
    })
    expect(ev.summary).toBe("")
    expect(ev.artifactPaths).toEqual([])
    expect(ev.capturedUrl).toBeNull()
  })
})
