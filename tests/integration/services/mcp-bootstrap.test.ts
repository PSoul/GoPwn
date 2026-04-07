/**
 * 集成测试：mcp-bootstrap
 * Mock fs 和 registry，使用 PGlite 验证 server 写入数据库
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { createTestDb, type TestDb } from "../../helpers/pglite-prisma"

// Mock prisma
vi.mock("@/lib/infra/prisma", () => ({ prisma: null as any }))

// Mock registry syncToolsFromServers
const mockSyncTools = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ synced: 3, errors: [] }),
)
vi.mock("@/lib/mcp/registry", () => ({
  syncToolsFromServers: mockSyncTools,
}))

// Mock fs.readFileSync
const mockReadFileSync = vi.hoisted(() => vi.fn())
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    readFileSync: mockReadFileSync,
  }
})

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
  vi.clearAllMocks()
})

describe("mcp-bootstrap", () => {
  let bootstrap: typeof import("@/lib/services/mcp-bootstrap")

  beforeAll(async () => {
    bootstrap = await import("@/lib/services/mcp-bootstrap")
  })

  describe("loadServersFromManifest", () => {
    it("manifest 正常 → 加载 server 数量正确", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({
        mcpServers: {
          "script": { command: "npx", args: ["tsx", "main.ts"] },
          "nmap": { command: "node", args: ["nmap-server.js"] },
        },
      }))

      const result = await bootstrap.loadServersFromManifest()
      expect(result.loaded).toBe(2)
      expect(result.errors).toHaveLength(0)

      // 验证数据写入了数据库
      const servers = await db.prisma.mcpServer.findMany()
      expect(servers).toHaveLength(2)
      expect(servers.map((s: any) => s.serverName).sort()).toEqual(["nmap", "script"])
    })

    it("manifest 文件不存在 → 返回错误", async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error("ENOENT: no such file")
      })

      const result = await bootstrap.loadServersFromManifest()
      expect(result.loaded).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain("ENOENT")
    })

    it("manifest JSON 格式错误 → 返回错误", async () => {
      mockReadFileSync.mockReturnValue("invalid json {{{")

      const result = await bootstrap.loadServersFromManifest()
      expect(result.loaded).toBe(0)
      expect(result.errors).toHaveLength(1)
    })
  })

  describe("bootstrapMcp", () => {
    it("完整流程 — load servers + sync tools", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({
        mcpServers: {
          "s1": { command: "node", args: ["index.js"] },
        },
      }))

      const result = await bootstrap.bootstrapMcp()
      expect(result.servers.loaded).toBe(1)
      expect(result.tools.synced).toBe(3) // from mockSyncTools
      expect(result.tools.errors).toHaveLength(0)
    })
  })
})
