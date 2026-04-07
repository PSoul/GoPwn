/**
 * 集成测试：llm-log-repo
 * 使用 PGlite 验证 LLM 调用日志的 CRUD 和清理操作
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

describe("llm-log-repo", () => {
  let repo: typeof import("@/lib/repositories/llm-log-repo")

  beforeAll(async () => {
    repo = await import("@/lib/repositories/llm-log-repo")
  })

  it("create → status=streaming, complete → status=completed", async () => {
    const project = await createProject()
    const log = await repo.create({
      projectId: project.id,
      role: "planner",
      phase: "recon",
      prompt: "test prompt",
      model: "gpt-4",
      provider: "openai",
    })
    expect(log.status).toBe("streaming")
    expect(log.projectId).toBe(project.id)

    const updated = await repo.complete(log.id, "response text", 1500)
    expect(updated.status).toBe("completed")
    expect(updated.durationMs).toBe(1500)
    expect(updated.response).toBe("response text")
  })

  it("fail → status=failed + error 信息", async () => {
    const project = await createProject("t2")
    const log = await repo.create({
      projectId: project.id,
      role: "planner",
      phase: "recon",
      prompt: "p",
      model: "gpt-4",
      provider: "openai",
    })
    const updated = await repo.fail(log.id, "timeout error")
    expect(updated.status).toBe("failed")
    expect(updated.error).toBe("timeout error")
  })

  it("findByProject — 返回指定项目的日志", async () => {
    const p1 = await createProject("t3")
    const p2 = await createProject("t4")
    await repo.create({ projectId: p1.id, role: "planner", phase: "recon", prompt: "a", model: "m", provider: "p" })
    await repo.create({ projectId: p1.id, role: "analyzer", phase: "discovery", prompt: "b", model: "m", provider: "p" })
    await repo.create({ projectId: p2.id, role: "planner", phase: "recon", prompt: "c", model: "m", provider: "p" })

    const logs = await repo.findByProject(p1.id)
    expect(logs).toHaveLength(2)
    expect(logs.every((l: any) => l.projectId === p1.id)).toBe(true)
  })

  it("cleanupStale — 清理超时 streaming 记录", async () => {
    const project = await createProject("t5")
    // 手动创建一条旧 streaming 记录
    await db.prisma.llmCallLog.create({
      data: {
        projectId: project.id,
        role: "planner",
        phase: "recon",
        prompt: "old prompt",
        model: "gpt-4",
        provider: "openai",
        status: "streaming",
        createdAt: new Date(Date.now() - 20 * 60 * 1000), // 20 分钟前
      },
    })
    // 创建一条近期的 streaming 记录（不应被清理）
    await repo.create({
      projectId: project.id,
      role: "planner",
      phase: "recon",
      prompt: "recent",
      model: "gpt-4",
      provider: "openai",
    })

    const result = await repo.cleanupStale(10)
    expect(result.count).toBe(1) // 只清理了旧的

    // 验证近期的记录仍然存在
    const remaining = await repo.findByProject(project.id)
    const streaming = remaining.filter((l: any) => l.status === "streaming")
    expect(streaming).toHaveLength(1)
    expect(streaming[0].prompt).toBe("recent")
  })
})
