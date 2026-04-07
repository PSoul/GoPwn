/**
 * 集成测试：settings-service
 * 使用 PGlite 内存数据库验证 LLM profiles 和全局配置的 CRUD
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

describe("settings-service", () => {
  let service: typeof import("@/lib/services/settings-service")

  beforeAll(async () => {
    service = await import("@/lib/services/settings-service")
  })

  describe("getLlmProfiles", () => {
    it("空 → 空数组", async () => {
      expect(await service.getLlmProfiles()).toEqual([])
    })
  })

  describe("upsertLlmProfile", () => {
    it("创建 + 读取", async () => {
      await service.upsertLlmProfile("planner", { model: "gpt-4", provider: "openai" })
      const profiles = await service.getLlmProfiles()
      expect(profiles).toHaveLength(1)
      expect(profiles[0].id).toBe("planner")
      expect(profiles[0].model).toBe("gpt-4")
      expect(profiles[0].provider).toBe("openai")
    })

    it("重复 upsert → 更新而非重复创建", async () => {
      await service.upsertLlmProfile("planner", { model: "gpt-4" })
      await service.upsertLlmProfile("planner", { model: "gpt-4o" })
      const profiles = await service.getLlmProfiles()
      expect(profiles).toHaveLength(1)
      expect(profiles[0].model).toBe("gpt-4o")
    })
  })

  describe("getGlobalConfig", () => {
    it("数据库有 global 记录 → 返回配置", async () => {
      // 先通过 updateGlobalConfig (upsert) 创建记录
      await service.updateGlobalConfig({ approvalEnabled: true })
      const config = await service.getGlobalConfig()
      expect(config).toBeDefined()
      expect(config!.id).toBe("global")
      expect(config!.approvalEnabled).toBe(true)
    })

    it("数据库无记录 → 自动创建默认配置", async () => {
      const config = await service.getGlobalConfig()
      expect(config).toBeDefined()
      expect(config!.id).toBe("global")
    })
  })

  describe("updateGlobalConfig", () => {
    it("更新配置字段", async () => {
      const updated = await service.updateGlobalConfig({ approvalEnabled: false })
      expect(updated.approvalEnabled).toBe(false)
    })
  })

  describe("getSystemStatus", () => {
    it("返回统计信息", async () => {
      const status = await service.getSystemStatus()
      expect(status.database).toBe("connected")
      expect(typeof status.tools).toBe("number")
      expect(typeof status.servers).toBe("number")
      expect(typeof status.llmProfiles).toBe("number")
    })
  })
})
