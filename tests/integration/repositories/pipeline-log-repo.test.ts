/**
 * 集成测试：pipeline-log-repo
 * 使用 PGlite 验证 Pipeline 日志的 CRUD 和清理操作
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

describe("pipeline-log-repo", () => {
  let repo: typeof import("@/lib/repositories/pipeline-log-repo")

  beforeAll(async () => {
    repo = await import("@/lib/repositories/pipeline-log-repo")
  })

  it("create + findByProject", async () => {
    const project = await createProject()
    await repo.create({
      projectId: project.id,
      jobType: "react_round",
      stage: "start",
      level: "info",
      message: "轮次开始",
    })
    const logs = await repo.findByProject(project.id)
    expect(logs).toHaveLength(1)
    expect(logs[0].message).toBe("轮次开始")
    expect(logs[0].jobType).toBe("react_round")
    expect(logs[0].level).toBe("info")
  })

  it("findByProject — level 过滤（info 过滤掉 debug）", async () => {
    const project = await createProject("t2")
    await repo.create({
      projectId: project.id,
      jobType: "react",
      stage: "s",
      level: "debug",
      message: "debug msg",
    })
    await repo.create({
      projectId: project.id,
      jobType: "react",
      stage: "s",
      level: "info",
      message: "info msg",
    })
    await repo.create({
      projectId: project.id,
      jobType: "react",
      stage: "s",
      level: "warn",
      message: "warn msg",
    })

    // 默认 level=info 过滤掉 debug
    const logs = await repo.findByProject(project.id)
    expect(logs).toHaveLength(2) // info + warn
    expect(logs.every((l: any) => l.level !== "debug")).toBe(true)

    // 显式指定 level=debug 返回所有
    const allLogs = await repo.findByProject(project.id, { level: "debug" })
    expect(allLogs).toHaveLength(3)

    // 指定 level=warn 只返回 warn + error
    const warnLogs = await repo.findByProject(project.id, { level: "warn" })
    expect(warnLogs).toHaveLength(1)
    expect(warnLogs[0].level).toBe("warn")
  })

  it("findByProject — round 过滤", async () => {
    const project = await createProject("t3")
    await repo.create({
      projectId: project.id,
      round: 1,
      jobType: "react",
      stage: "s",
      level: "info",
      message: "round 1",
    })
    await repo.create({
      projectId: project.id,
      round: 2,
      jobType: "react",
      stage: "s",
      level: "info",
      message: "round 2",
    })

    const round1 = await repo.findByProject(project.id, { round: 1 })
    expect(round1).toHaveLength(1)
    expect(round1[0].message).toBe("round 1")
  })

  it("countByProject — 按 level 计数", async () => {
    const project = await createProject("t4")
    await repo.create({ projectId: project.id, jobType: "r", stage: "s", level: "debug", message: "d" })
    await repo.create({ projectId: project.id, jobType: "r", stage: "s", level: "info", message: "i" })
    await repo.create({ projectId: project.id, jobType: "r", stage: "s", level: "warn", message: "w" })

    const countInfo = await repo.countByProject(project.id, "info")
    expect(countInfo).toBe(2) // info + warn

    const countAll = await repo.countByProject(project.id, "debug")
    expect(countAll).toBe(3)
  })

  it("cleanupOld — 删除旧 debug 日志", async () => {
    const project = await createProject("t5")

    // 手动创建一条旧 debug 日志
    await db.prisma.pipelineLog.create({
      data: {
        projectId: project.id,
        jobType: "react",
        stage: "s",
        level: "debug",
        message: "old debug",
        createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 天前
      },
    })
    // 创建一条近期 debug 日志（不应被删除）
    await repo.create({
      projectId: project.id,
      jobType: "react",
      stage: "s",
      level: "debug",
      message: "recent debug",
    })
    // 创建一条旧 info 日志（不应被删除，cleanupOld 只删 debug）
    await db.prisma.pipelineLog.create({
      data: {
        projectId: project.id,
        jobType: "react",
        stage: "s",
        level: "info",
        message: "old info",
        createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      },
    })

    const deleted = await repo.cleanupOld(30)
    expect(deleted).toBe(1) // 只删除了旧 debug

    // 验证剩余记录：recent debug + old info = 2（level:debug 返回 debug+info+warn+error）
    const remaining = await repo.findByProject(project.id, { level: "debug" })
    expect(remaining).toHaveLength(2)
  })
})
