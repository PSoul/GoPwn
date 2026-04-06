/**
 * 集成测试：asset-repo
 * 使用 PGlite 验证资产的 upsert、父子关联、fingerprint 和计数
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

describe("asset-repo", () => {
  let repo: typeof import("@/lib/repositories/asset-repo")
  let seedProjectId: string

  beforeAll(async () => {
    repo = await import("@/lib/repositories/asset-repo")
  })

  beforeEach(async () => {
    const project = await db.prisma.project.create({
      data: { code: `proj-${Date.now()}`, name: "Asset 测试项目" },
    })
    seedProjectId = project.id
  })

  describe("upsert", () => {
    it("首次应创建新资产", async () => {
      const asset = await repo.upsert({
        projectId: seedProjectId,
        kind: "ip",
        value: "192.168.1.1",
        label: "内网 IP",
        confidence: 0.9,
      })

      expect(asset.id).toBeDefined()
      expect(asset.kind).toBe("ip")
      expect(asset.value).toBe("192.168.1.1")
      expect(asset.confidence).toBe(0.9)
    })

    it("相同 projectId+kind+value 不重复创建（upsert 更新）", async () => {
      const first = await repo.upsert({
        projectId: seedProjectId,
        kind: "ip",
        value: "192.168.1.1",
        label: "旧标签",
        confidence: 0.5,
      })

      const second = await repo.upsert({
        projectId: seedProjectId,
        kind: "ip",
        value: "192.168.1.1",
        label: "新标签",
        confidence: 0.95,
      })

      // 应为同一条记录
      expect(second.id).toBe(first.id)
      // label 和 confidence 应被更新
      expect(second.label).toBe("新标签")
      expect(second.confidence).toBe(0.95)

      // 总数应为 1
      const count = await repo.countByProject(seedProjectId)
      expect(count).toBe(1)
    })

    it("不同 kind 应创建不同资产", async () => {
      await repo.upsert({
        projectId: seedProjectId,
        kind: "ip",
        value: "192.168.1.1",
        label: "IP",
      })
      await repo.upsert({
        projectId: seedProjectId,
        kind: "domain",
        value: "192.168.1.1",
        label: "Domain",
      })

      const count = await repo.countByProject(seedProjectId)
      expect(count).toBe(2)
    })
  })

  describe("父子关联", () => {
    it("应建立 parent-child 关系", async () => {
      const parent = await repo.upsert({
        projectId: seedProjectId,
        kind: "ip",
        value: "10.0.0.1",
        label: "目标 IP",
      })

      const child = await repo.upsert({
        projectId: seedProjectId,
        kind: "port",
        value: "10.0.0.1:80",
        label: "HTTP (80)",
        parentId: parent.id,
      })

      // findById 应包含 parent 和 children
      const foundChild = await repo.findById(child.id)
      expect(foundChild!.parent).not.toBeNull()
      expect(foundChild!.parent!.id).toBe(parent.id)

      const foundParent = await repo.findById(parent.id)
      expect(foundParent!.children).toHaveLength(1)
      expect(foundParent!.children[0].id).toBe(child.id)
    })

    it("findTreeRoots 应只返回无 parent 的根节点", async () => {
      const root = await repo.upsert({
        projectId: seedProjectId,
        kind: "ip",
        value: "10.0.0.1",
        label: "根 IP",
      })
      await repo.upsert({
        projectId: seedProjectId,
        kind: "port",
        value: "10.0.0.1:443",
        label: "HTTPS (443)",
        parentId: root.id,
      })

      const roots = await repo.findTreeRoots(seedProjectId)
      expect(roots).toHaveLength(1)
      expect(roots[0].id).toBe(root.id)
      // 应包含嵌套 children
      expect(roots[0].children).toHaveLength(1)
    })
  })

  describe("findByProject", () => {
    it("应返回项目所有资产及 fingerprints 和 _count", async () => {
      await repo.upsert({
        projectId: seedProjectId,
        kind: "ip",
        value: "1.1.1.1",
        label: "测试",
      })

      const assets = await repo.findByProject(seedProjectId)
      expect(assets).toHaveLength(1)
      expect(assets[0].fingerprints).toEqual([])
      expect(assets[0]._count).toBeDefined()
    })
  })

  describe("addFingerprint", () => {
    it("应为资产添加指纹", async () => {
      const asset = await repo.upsert({
        projectId: seedProjectId,
        kind: "webapp",
        value: "http://example.com",
        label: "Web 应用",
      })

      const fp = await repo.addFingerprint(asset.id, {
        category: "server",
        value: "nginx/1.18",
        source: "httpx",
        confidence: 0.85,
      })

      expect(fp.id).toBeDefined()
      expect(fp.assetId).toBe(asset.id)
      expect(fp.category).toBe("server")

      // findById 应包含 fingerprints
      const found = await repo.findById(asset.id)
      expect(found!.fingerprints).toHaveLength(1)
    })
  })

  describe("countByProject", () => {
    it("应正确计数", async () => {
      await repo.upsert({ projectId: seedProjectId, kind: "ip", value: "a", label: "a" })
      await repo.upsert({ projectId: seedProjectId, kind: "ip", value: "b", label: "b" })
      await repo.upsert({ projectId: seedProjectId, kind: "port", value: "c", label: "c" })

      const count = await repo.countByProject(seedProjectId)
      expect(count).toBe(3)
    })

    it("空项目应返回 0", async () => {
      const count = await repo.countByProject(seedProjectId)
      expect(count).toBe(0)
    })
  })

  describe("findPortsByIpAsset", () => {
    it("应返回 IP 下的端口资产", async () => {
      const ip = await repo.upsert({
        projectId: seedProjectId,
        kind: "ip",
        value: "10.0.0.1",
        label: "IP",
      })
      await repo.upsert({
        projectId: seedProjectId,
        kind: "port",
        value: "10.0.0.1:80",
        label: "HTTP",
        parentId: ip.id,
      })
      await repo.upsert({
        projectId: seedProjectId,
        kind: "port",
        value: "10.0.0.1:443",
        label: "HTTPS",
        parentId: ip.id,
      })

      const ports = await repo.findPortsByIpAsset(ip.id)
      expect(ports).toHaveLength(2)
    })
  })
})
