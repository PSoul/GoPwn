import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createTestDb, type TestDb } from "../../helpers/pglite-prisma"

describe("PGlite smoke test", () => {
  let db: TestDb

  beforeAll(async () => {
    db = await createTestDb()
  }, 30_000)

  afterAll(async () => {
    await db?.cleanup()
  })

  it("can create and query a project", async () => {
    const project = await db.prisma.project.create({
      data: { code: "test-001", name: "Smoke Test" },
    })
    expect(project.id).toBeDefined()
    expect(project.lifecycle).toBe("idle")
    expect(project.currentPhase).toBe("recon")
  })

  it("can truncate and verify empty", async () => {
    await db.truncateAll()
    const projects = await db.prisma.project.findMany()
    expect(projects).toHaveLength(0)
  })
})
