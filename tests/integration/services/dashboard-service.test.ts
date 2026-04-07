/**
 * 集成测试：dashboard-service
 * 使用 PGlite 验证 Dashboard 聚合查询
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

/** 辅助：创建一个最小的项目记录 */
async function createProject(name: string, lifecycle: string = "idle") {
  return db.prisma.project.create({
    data: {
      code: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      lifecycle: lifecycle as any,
      updatedAt: new Date(),
    },
  })
}

describe("dashboard-service", () => {
  let service: typeof import("@/lib/services/dashboard-service")

  beforeAll(async () => {
    service = await import("@/lib/services/dashboard-service")
  })

  it("无数据 → 返回零值聚合", async () => {
    const data = await service.getDashboardData()
    expect(data.projectCount).toBe(0)
    expect(data.activeCount).toBe(0)
    expect(data.findingStats).toEqual([])
  })

  it("有项目数据 → projectCount 正确", async () => {
    await createProject("test-proj-1")
    const data = await service.getDashboardData()
    expect(data.projectCount).toBe(1)
  })

  it("active 项目计数正确", async () => {
    await createProject("idle-proj", "idle")
    await createProject("planning-proj", "planning")
    await createProject("executing-proj", "executing")
    const data = await service.getDashboardData()
    expect(data.projectCount).toBe(3)
    // planning + executing = 2 active
    expect(data.activeCount).toBe(2)
  })

  it("recentProjects 最多 5 条", async () => {
    for (let i = 0; i < 7; i++) {
      await createProject(`p${i}`)
    }
    const data = await service.getDashboardData()
    expect(data.recentProjects.length).toBeLessThanOrEqual(5)
  })

  it("projectStats 按 lifecycle 分组", async () => {
    await createProject("p1", "idle")
    await createProject("p2", "idle")
    await createProject("p3", "planning")
    const data = await service.getDashboardData()
    expect(data.projectStats.length).toBeGreaterThanOrEqual(1)
    const idleStat = data.projectStats.find((s: any) => s.lifecycle === "idle")
    expect(idleStat?._count).toBe(2)
  })
})
