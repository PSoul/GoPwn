/**
 * 集成测试：mcp-tool-repo
 * 使用 PGlite 验证 MCP 工具的 CRUD 操作
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

describe("mcp-tool-repo", () => {
  let repo: typeof import("@/lib/repositories/mcp-tool-repo")

  beforeAll(async () => {
    repo = await import("@/lib/repositories/mcp-tool-repo")
  })

  it("upsert + findAll", async () => {
    await repo.upsert({ serverName: "script", toolName: "nmap_scan", capability: "recon" })
    const all = await repo.findAll()
    expect(all).toHaveLength(1)
    expect(all[0].toolName).toBe("nmap_scan")
    expect(all[0].serverName).toBe("script")
    expect(all[0].capability).toBe("recon")
    expect(all[0].enabled).toBe(true) // 默认值
  })

  it("findEnabled — 只返回 enabled=true", async () => {
    await repo.upsert({ serverName: "s1", toolName: "t1", capability: "recon" })
    await repo.upsert({ serverName: "s1", toolName: "t2", capability: "vuln" })
    // 禁用 t1
    await db.prisma.mcpTool.update({ where: { toolName: "t1" }, data: { enabled: false } })

    const enabled = await repo.findEnabled()
    expect(enabled).toHaveLength(1)
    expect(enabled[0].toolName).toBe("t2")
  })

  it("findByToolName — 存在 vs 不存在", async () => {
    await repo.upsert({ serverName: "s1", toolName: "zap_scan", capability: "vuln" })
    const found = await repo.findByToolName("zap_scan")
    expect(found).toBeDefined()
    expect(found!.toolName).toBe("zap_scan")

    const notFound = await repo.findByToolName("nope")
    expect(notFound).toBeNull()
  })

  it("upsert — 重复调用更新而非重复创建", async () => {
    await repo.upsert({ serverName: "s1", toolName: "t1", capability: "recon" })
    await repo.upsert({ serverName: "s2", toolName: "t1", capability: "vuln" })

    const tool = await repo.findByToolName("t1")
    expect(tool!.serverName).toBe("s2")
    expect(tool!.capability).toBe("vuln")

    const all = await repo.findAll()
    expect(all).toHaveLength(1) // 没有重复
  })

  it("findByCapability — 按 capability 过滤", async () => {
    await repo.upsert({ serverName: "s1", toolName: "nmap", capability: "recon" })
    await repo.upsert({ serverName: "s1", toolName: "zap", capability: "vuln" })
    await repo.upsert({ serverName: "s1", toolName: "ffuf", capability: "recon" })

    const recon = await repo.findByCapability("recon")
    expect(recon).toHaveLength(2)
    expect(recon.map((t: any) => t.toolName).sort()).toEqual(["ffuf", "nmap"])
  })

  describe("upsertServer", () => {
    it("创建 + 更新 MCP server", async () => {
      await repo.upsertServer({
        serverName: "script-mcp",
        transport: "stdio",
        command: "npx",
        args: ["tsx", "main.ts"],
      })

      const servers = await repo.findAllServers()
      expect(servers).toHaveLength(1)
      expect(servers[0].serverName).toBe("script-mcp")
      expect(servers[0].transport).toBe("stdio")

      // Update
      await repo.upsertServer({
        serverName: "script-mcp",
        transport: "stdio",
        command: "node",
        args: ["dist/main.js"],
      })

      const updated = await repo.findAllServers()
      expect(updated).toHaveLength(1)
      expect(updated[0].command).toBe("node")
    })
  })
})
