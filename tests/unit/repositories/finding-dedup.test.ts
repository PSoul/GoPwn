import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Prisma mock ──────────────────────────────────────────────
// 用内存数组模拟 finding 表，追踪 create vs update 行为
let fakeFindingDb: Array<{
  id: string
  projectId: string
  title: string
  severity: string
  summary: string
  affectedTarget: string
  recommendation: string
  evidenceId?: string
}>
let idCounter: number

vi.mock("@/lib/infra/prisma", () => ({
  prisma: {
    finding: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/infra/prisma"
import { create } from "@/lib/repositories/finding-repo"
import type { Severity } from "@/lib/generated/prisma"

/** 向 fake DB 插入一条 finding 并注册到 mock */
function seedFinding(partial: {
  title: string
  affectedTarget: string
  severity?: string
  projectId?: string
}) {
  const f = {
    id: `f-${++idCounter}`,
    projectId: partial.projectId ?? "proj-1",
    title: partial.title,
    severity: partial.severity ?? "high",
    summary: "",
    affectedTarget: partial.affectedTarget,
    recommendation: "",
  }
  fakeFindingDb.push(f)
  return f
}

/** 调用 create() 并返回 Prisma 实际执行的操作类型 */
async function callCreate(title: string, target: string, severity: Severity = "high") {
  const result = await create({
    projectId: "proj-1",
    title,
    affectedTarget: target,
    severity,
    summary: `summary for ${title}`,
  })
  return result
}

beforeEach(() => {
  vi.clearAllMocks()
  fakeFindingDb = []
  idCounter = 0

  // findFirst: exact match
  vi.mocked(prisma.finding.findFirst).mockImplementation(async (args: any) => {
    return fakeFindingDb.find(
      (f) =>
        f.projectId === args.where.projectId &&
        f.title === args.where.title &&
        f.affectedTarget === args.where.affectedTarget,
    ) ?? null
  })

  // findMany: return all findings for the project
  vi.mocked(prisma.finding.findMany).mockImplementation(async (args: any) => {
    return fakeFindingDb.filter((f) => f.projectId === args.where.projectId)
  })

  // create: insert into fake DB
  vi.mocked(prisma.finding.create).mockImplementation(async (args: any) => {
    const f = {
      id: `f-${++idCounter}`,
      ...args.data,
    }
    fakeFindingDb.push(f)
    return f
  })

  // update: update in fake DB
  vi.mocked(prisma.finding.update).mockImplementation(async (args: any) => {
    const idx = fakeFindingDb.findIndex((f) => f.id === args.where.id)
    if (idx >= 0) {
      Object.assign(fakeFindingDb[idx], args.data)
      return fakeFindingDb[idx]
    }
    throw new Error(`finding ${args.where.id} not found`)
  })
})

// ════════════════════════════════════════════════════════════════
// 测试组 1：不同服务的同类漏洞 → 不应合并（核心 bug 回归测试）
// ════════════════════════════════════════════════════════════════
describe("不同服务同类漏洞不应合并", () => {
  // --- 未授权访问 ---
  it("Redis 未授权访问 vs MongoDB 未授权访问 → 两条独立记录", async () => {
    seedFinding({ title: "Redis 未授权访问", affectedTarget: "10.0.0.1:6379" })
    await callCreate("MongoDB 未授权访问", "10.0.0.1:27017")
    expect(prisma.finding.create).toHaveBeenCalled()
    expect(prisma.finding.update).not.toHaveBeenCalled()
  })

  it("Elasticsearch 未授权访问 vs Redis 未授权访问 → 两条独立记录", async () => {
    seedFinding({ title: "Redis 未授权访问（无需认证可直接交互）", affectedTarget: "10.0.0.1:6379" })
    await callCreate("Elasticsearch 未授权访问", "10.0.0.1:9200")
    expect(prisma.finding.create).toHaveBeenCalled()
    expect(prisma.finding.update).not.toHaveBeenCalled()
  })

  it("MySQL Unauthorized Access vs PostgreSQL Unauthorized Access → 两条", async () => {
    seedFinding({ title: "MySQL Unauthorized Access", affectedTarget: "10.0.0.1:3306" })
    await callCreate("PostgreSQL Unauthorized Access", "10.0.0.1:5432")
    expect(prisma.finding.create).toHaveBeenCalled()
    expect(prisma.finding.update).not.toHaveBeenCalled()
  })

  // --- 弱口令 ---
  it("Redis 弱口令 vs MySQL 弱口令 → 两条", async () => {
    seedFinding({ title: "Redis 弱口令", affectedTarget: "10.0.0.1:6379" })
    await callCreate("MySQL 弱口令", "10.0.0.1:3306")
    expect(prisma.finding.create).toHaveBeenCalled()
    expect(prisma.finding.update).not.toHaveBeenCalled()
  })

  it("SSH Weak Password vs FTP Weak Password → 两条", async () => {
    seedFinding({ title: "SSH Weak Password", affectedTarget: "10.0.0.1:22" })
    await callCreate("FTP Weak Password", "10.0.0.1:21")
    expect(prisma.finding.create).toHaveBeenCalled()
    expect(prisma.finding.update).not.toHaveBeenCalled()
  })

  // --- 信息泄露 ---
  it("Redis 信息泄露 vs MongoDB 信息泄露 → 两条", async () => {
    seedFinding({ title: "Redis 信息泄露", affectedTarget: "10.0.0.1:6379" })
    await callCreate("MongoDB 信息泄露", "10.0.0.1:27017")
    expect(prisma.finding.create).toHaveBeenCalled()
    expect(prisma.finding.update).not.toHaveBeenCalled()
  })

  // --- 版本暴露 ---
  it("Nginx 服务器版本暴露 vs Apache 服务器版本暴露 → 两条", async () => {
    seedFinding({ title: "Nginx 服务器版本暴露", affectedTarget: "10.0.0.1:80" })
    await callCreate("Apache 服务器版本暴露", "10.0.0.1:8080")
    expect(prisma.finding.create).toHaveBeenCalled()
    expect(prisma.finding.update).not.toHaveBeenCalled()
  })

  // --- 目录遍历 ---
  it("Nginx 目录浏览 vs Tomcat 目录遍历 → 两条", async () => {
    seedFinding({ title: "Nginx 目录浏览", affectedTarget: "10.0.0.1:80" })
    await callCreate("Tomcat 目录遍历", "10.0.0.1:8080")
    expect(prisma.finding.create).toHaveBeenCalled()
    expect(prisma.finding.update).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// 测试组 2：同一服务同类漏洞 → 应该合并
// ════════════════════════════════════════════════════════════════
describe("同一服务同类漏洞应合并", () => {
  it("Redis 未授权访问 + Redis 未授权访问（无需认证可直接交互）→ 合并", async () => {
    seedFinding({ title: "Redis 未授权访问", affectedTarget: "10.0.0.1:6379" })
    await callCreate("Redis 未授权访问（无需认证可直接交互）", "10.0.0.1:6379")
    expect(prisma.finding.update).toHaveBeenCalled()
    expect(prisma.finding.create).not.toHaveBeenCalled()
  })

  it("Redis 弱口令 + Redis 弱密码 → 合并（同义词归一化）", async () => {
    seedFinding({ title: "Redis 弱口令", affectedTarget: "10.0.0.1:6379" })
    await callCreate("Redis 弱密码", "10.0.0.1:6379")
    expect(prisma.finding.update).toHaveBeenCalled()
    expect(prisma.finding.create).not.toHaveBeenCalled()
  })

  it("中英互转：Redis 未授权访问 + Redis Unauthorized Access → 合并", async () => {
    seedFinding({ title: "Redis 未授权访问", affectedTarget: "10.0.0.1:6379" })
    await callCreate("Redis Unauthorized Access", "10.0.0.1:6379")
    expect(prisma.finding.update).toHaveBeenCalled()
    expect(prisma.finding.create).not.toHaveBeenCalled()
  })

  it("完全相同标题 → exact match 合并", async () => {
    seedFinding({ title: "SQL 注入", affectedTarget: "10.0.0.1:80/login" })
    await callCreate("SQL 注入", "10.0.0.1:80/login")
    // exact match 走 findFirst 路径，不进入 fuzzy
    expect(prisma.finding.update).toHaveBeenCalled()
    expect(prisma.finding.create).not.toHaveBeenCalled()
  })

  it("severity 升级：info → high", async () => {
    seedFinding({ title: "Redis 未授权访问", affectedTarget: "10.0.0.1:6379", severity: "info" })
    await callCreate("Redis 未授权访问（高危）", "10.0.0.1:6379", "high")
    expect(prisma.finding.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ severity: "high" }),
      }),
    )
  })
})

// ════════════════════════════════════════════════════════════════
// 测试组 3：捏造/不存在的服务名 → 不应互相合并（鲁棒性测试）
// ════════════════════════════════════════════════════════════════
describe("虚构/罕见服务名 — 鲁棒性测试", () => {
  it("ZorgDB 未授权访问 vs PlonkMQ 未授权访问 → 两条", async () => {
    seedFinding({ title: "ZorgDB 未授权访问", affectedTarget: "10.0.0.1:9999" })
    await callCreate("PlonkMQ 未授权访问", "10.0.0.1:8888")
    expect(prisma.finding.create).toHaveBeenCalled()
    expect(prisma.finding.update).not.toHaveBeenCalled()
  })

  it("FooCache 弱口令 vs BarStore 弱口令 → 两条", async () => {
    seedFinding({ title: "FooCache 弱口令", affectedTarget: "10.0.0.1:11211" })
    await callCreate("BarStore 弱口令", "10.0.0.1:6380")
    expect(prisma.finding.create).toHaveBeenCalled()
    expect(prisma.finding.update).not.toHaveBeenCalled()
  })

  it("QuantumDB Information Disclosure vs HyperMQ Information Disclosure → 两条", async () => {
    seedFinding({ title: "QuantumDB Information Disclosure", affectedTarget: "10.0.0.1:5555" })
    await callCreate("HyperMQ Information Disclosure", "10.0.0.1:6666")
    expect(prisma.finding.create).toHaveBeenCalled()
    expect(prisma.finding.update).not.toHaveBeenCalled()
  })

  it("同一虚构服务重复报告 → 应合并", async () => {
    seedFinding({ title: "ZorgDB 未授权访问", affectedTarget: "10.0.0.1:9999" })
    await callCreate("ZorgDB 未授权访问（可读写所有集合）", "10.0.0.1:9999")
    expect(prisma.finding.update).toHaveBeenCalled()
    expect(prisma.finding.create).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// 测试组 4：无服务名的纯漏洞类型 → 同类应合并
// ════════════════════════════════════════════════════════════════
describe("无服务名的纯漏洞类型", () => {
  it("未授权访问 + Unauthorized Access → 合并", async () => {
    seedFinding({ title: "未授权访问", affectedTarget: "10.0.0.1:8080" })
    await callCreate("Unauthorized Access", "10.0.0.1:8080")
    expect(prisma.finding.update).toHaveBeenCalled()
    expect(prisma.finding.create).not.toHaveBeenCalled()
  })

  it("SQL 注入 + SQL Injection → 合并", async () => {
    seedFinding({ title: "SQL 注入", affectedTarget: "10.0.0.1:80" })
    await callCreate("SQL Injection", "10.0.0.1:80")
    expect(prisma.finding.update).toHaveBeenCalled()
    expect(prisma.finding.create).not.toHaveBeenCalled()
  })

  it("跨站脚本 + XSS → 合并", async () => {
    seedFinding({ title: "跨站脚本", affectedTarget: "10.0.0.1:80/search" })
    await callCreate("XSS", "10.0.0.1:80/search")
    expect(prisma.finding.update).toHaveBeenCalled()
    expect(prisma.finding.create).not.toHaveBeenCalled()
  })

  it("弱口令 + Weak Password → 合并", async () => {
    seedFinding({ title: "弱口令", affectedTarget: "10.0.0.1:22" })
    await callCreate("Weak Password", "10.0.0.1:22")
    expect(prisma.finding.update).toHaveBeenCalled()
    expect(prisma.finding.create).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// 测试组 5：不同主机 → 不应合并
// ════════════════════════════════════════════════════════════════
describe("不同主机不合并", () => {
  it("同标题但不同 IP → 两条", async () => {
    seedFinding({ title: "Redis 未授权访问", affectedTarget: "10.0.0.1:6379" })
    await callCreate("Redis 未授权访问", "10.0.0.2:6379")
    expect(prisma.finding.create).toHaveBeenCalled()
    expect(prisma.finding.update).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// 测试组 6：完全不同的漏洞类型 → 不应合并
// ════════════════════════════════════════════════════════════════
describe("不同漏洞类型不合并", () => {
  it("Redis 未授权访问 vs Redis 弱口令 → 两条", async () => {
    seedFinding({ title: "Redis 未授权访问", affectedTarget: "10.0.0.1:6379" })
    await callCreate("Redis 弱口令", "10.0.0.1:6379")
    expect(prisma.finding.create).toHaveBeenCalled()
    expect(prisma.finding.update).not.toHaveBeenCalled()
  })

  it("SQL 注入 vs XSS → 两条", async () => {
    seedFinding({ title: "SQL 注入", affectedTarget: "10.0.0.1:80/login" })
    await callCreate("XSS", "10.0.0.1:80/login")
    expect(prisma.finding.create).toHaveBeenCalled()
    expect(prisma.finding.update).not.toHaveBeenCalled()
  })

  it("目录浏览 vs 信息泄露 → 两条", async () => {
    seedFinding({ title: "目录浏览", affectedTarget: "10.0.0.1:80" })
    await callCreate("信息泄露", "10.0.0.1:80")
    expect(prisma.finding.create).toHaveBeenCalled()
    expect(prisma.finding.update).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// 测试组 7：大量漏洞混合场景（压力测试）
// ════════════════════════════════════════════════════════════════
describe("大批量混合漏洞 — 不同服务不应交叉合并", () => {
  const services = [
    "Redis", "MongoDB", "MySQL", "PostgreSQL", "Elasticsearch",
    "Memcached", "CouchDB", "Cassandra", "InfluxDB", "Neo4j",
    "ClickHouse", "TiDB", "DragonflyDB", "KeyDB", "Valkey",
  ]
  const vulnTypes = ["未授权访问", "弱口令", "信息泄露"]

  it(`${services.length} 个服务 × ${vulnTypes.length} 种漏洞类型 → 全部独立`, async () => {
    let port = 6000
    // 先入库第一个服务的所有漏洞
    for (const vuln of vulnTypes) {
      seedFinding({
        title: `${services[0]} ${vuln}`,
        affectedTarget: `10.0.0.1:${port++}`,
      })
    }

    // 其余 14 个服务的同类漏洞逐一创建，全部应为新记录
    let createCount = 0
    for (let i = 1; i < services.length; i++) {
      for (const vuln of vulnTypes) {
        vi.mocked(prisma.finding.create).mockClear()
        vi.mocked(prisma.finding.update).mockClear()

        await callCreate(`${services[i]} ${vuln}`, `10.0.0.1:${port++}`)

        if ((prisma.finding.create as any).mock.calls.length === 1) {
          createCount++
        } else {
          throw new Error(
            `"${services[i]} ${vuln}" 被错误合并到已有 finding！` +
            `预期 create 但实际调用了 update`,
          )
        }
      }
    }

    // (services.length - 1) * vulnTypes.length = 14 * 3 = 42
    expect(createCount).toBe((services.length - 1) * vulnTypes.length)
  })
})

// ════════════════════════════════════════════════════════════════
// 测试组 8：同一主机上多服务多漏洞 — 真实渗透场景
// ════════════════════════════════════════════════════════════════
describe("真实渗透场景：同主机多服务", () => {
  it("10.0.0.1 上 Redis/MongoDB/MySQL 各有未授权+弱口令 → 6 条独立 finding", async () => {
    const host = "10.0.0.1"
    const findings = [
      { title: "Redis 未授权访问", target: `${host}:6379` },
      { title: "Redis 弱口令", target: `${host}:6379` },
      { title: "MongoDB 未授权访问", target: `${host}:27017` },
      { title: "MongoDB 弱口令", target: `${host}:27017` },
      { title: "MySQL 未授权访问", target: `${host}:3306` },
      { title: "MySQL 弱口令", target: `${host}:3306` },
    ]

    for (const f of findings) {
      await callCreate(f.title, f.target)
    }

    expect(fakeFindingDb).toHaveLength(6)
    const titles = fakeFindingDb.map((f) => f.title)
    for (const f of findings) {
      expect(titles).toContain(f.title)
    }
  })

  it("同一 IP 不同端口同服务 → 不同端口但同 host 应合并", async () => {
    // Redis 在两个端口，但 rootHost 相同（都是 10.0.0.1），normalizeTitle 也相同 → 合并
    seedFinding({ title: "Redis 未授权访问", affectedTarget: "10.0.0.1:6379" })
    await callCreate("Redis 未授权访问", "10.0.0.1:6380")
    // 相同 rootHost + 相同归一化标题 → 应该合并
    expect(prisma.finding.update).toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// 测试组 9：纯中文无英文服务名 — 测试 bigram 路径
// ════════════════════════════════════════════════════════════════
describe("纯中文标题的去重", () => {
  it("数据库未授权访问 vs 缓存未授权访问 → 两条（不同中文前缀）", async () => {
    seedFinding({ title: "数据库未授权访问", affectedTarget: "10.0.0.1:3306" })
    await callCreate("缓存未授权访问", "10.0.0.1:6379")
    expect(prisma.finding.create).toHaveBeenCalled()
    expect(prisma.finding.update).not.toHaveBeenCalled()
  })

  it("数据库未授权访问 + 数据库未授权访问（可读取全部数据）→ 合并", async () => {
    seedFinding({ title: "数据库未授权访问", affectedTarget: "10.0.0.1:3306" })
    await callCreate("数据库未授权访问（可读取全部数据）", "10.0.0.1:3306")
    expect(prisma.finding.update).toHaveBeenCalled()
    expect(prisma.finding.create).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// 测试组 10：边界情况与回归保护
// ════════════════════════════════════════════════════════════════
describe("边界情况", () => {
  // 服务名 + 纯漏洞类型（无服务名）→ 同 host 时应合并（后者是前者的泛化描述）
  it("Redis 未授权访问 vs 未授权访问（同 host）→ 合并", async () => {
    seedFinding({ title: "Redis 未授权访问", affectedTarget: "10.0.0.1:6379" })
    await callCreate("未授权访问", "10.0.0.1:6379")
    expect(prisma.finding.update).toHaveBeenCalled()
    expect(prisma.finding.create).not.toHaveBeenCalled()
  })

  // 多词英文漏洞类型 + 不同服务名 → 互斥守卫应正确触发
  it("Redis Default Credential vs MongoDB Default Credential → 两条", async () => {
    seedFinding({ title: "Redis Default Credential", affectedTarget: "10.0.0.1:6379" })
    await callCreate("MongoDB Default Credential", "10.0.0.1:27017")
    expect(prisma.finding.create).toHaveBeenCalled()
    expect(prisma.finding.update).not.toHaveBeenCalled()
  })

  // 同义词跨语言：Default Password = 弱口令
  it("Default Password + Weak Password → 合并（同义词归一化）", async () => {
    seedFinding({ title: "Default Password", affectedTarget: "10.0.0.1:22" })
    await callCreate("Weak Password", "10.0.0.1:22")
    expect(prisma.finding.update).toHaveBeenCalled()
    expect(prisma.finding.create).not.toHaveBeenCalled()
  })

  // 不同漏洞 + 同服务 → 不合并
  it("Redis 未授权访问 vs Redis 信息泄露 → 两条（同服务不同漏洞类型）", async () => {
    seedFinding({ title: "Redis 未授权访问", affectedTarget: "10.0.0.1:6379" })
    await callCreate("Redis 信息泄露", "10.0.0.1:6379")
    expect(prisma.finding.create).toHaveBeenCalled()
    expect(prisma.finding.update).not.toHaveBeenCalled()
  })

  // 完全不相关的漏洞 → 不合并
  it("phpMyAdmin 默认密码 vs Grafana SSRF → 两条", async () => {
    seedFinding({ title: "phpMyAdmin 默认密码", affectedTarget: "10.0.0.1:80" })
    await callCreate("Grafana SSRF", "10.0.0.1:3000")
    expect(prisma.finding.create).toHaveBeenCalled()
    expect(prisma.finding.update).not.toHaveBeenCalled()
  })

  // 中英文描述差异大但同一漏洞：Redis 免密 vs Redis Unauthenticated Access
  // 已知限制：跨语言 + 非标准同义词的极端情况，宁可不合并（安全侧）
  // 实际场景中 LLM 会生成标准标题（如 "Redis 未授权访问"），Tier 1 normalizeTitle 可正确合并
  it("Redis 免密 vs Redis Unauthenticated Access → 不合并（已知限制）", async () => {
    seedFinding({ title: "Redis 免密", affectedTarget: "10.0.0.1:6379" })
    await callCreate("Redis Unauthenticated Access", "10.0.0.1:6379")
    // Tier 1: normalizeTitle("redis 免密") 不匹配任何 zhEnMap → "redis 免密"
    //         normalizeTitle("redis unauthenticated access") → "redis unauthorized access"
    //         不同 → 跳过
    // Tier 2: tokenize("Redis 免密") → synonym "免密"→"未授权" → {redis, 未授, 授权}
    //         tokenize("Redis Unauthenticated Access") → {redis, unauthenticated, access}
    //         small={redis, unauthenticated, access}(3), large={redis, 未授, 授权}(3)
    //         coverage = 1/3 = 0.33 < 0.7 → 不合并
    expect(prisma.finding.create).toHaveBeenCalled()
  })

  // 空标题、单字标题等极端输入
  it("单字标题不触发 Tier 2（token 数量不足）", async () => {
    seedFinding({ title: "XSS", affectedTarget: "10.0.0.1:80" })
    await callCreate("CSRF", "10.0.0.1:80")
    expect(prisma.finding.create).toHaveBeenCalled()
  })

  // severity 不降级
  it("severity 不降级：high → info 保持 high", async () => {
    seedFinding({ title: "Redis 未授权访问", affectedTarget: "10.0.0.1:6379", severity: "high" })
    await callCreate("Redis 未授权访问", "10.0.0.1:6379", "info")
    expect(prisma.finding.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ severity: "info" }),
      }),
    )
  })
})
