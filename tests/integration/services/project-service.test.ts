/**
 * 集成测试：project-service
 * 使用 PGlite 做真实数据库，mock 外部基础设施（job-queue, event-bus, abort-registry）
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { createTestDb, type TestDb } from "../../helpers/pglite-prisma"

// Mock prisma 模块
vi.mock("@/lib/infra/prisma", () => ({ prisma: null as any }))

// Mock 外部基础设施
const mockPublish = vi.fn().mockResolvedValue(undefined)
const mockCancelByProject = vi.fn().mockResolvedValue(0)
vi.mock("@/lib/infra/job-queue", () => ({
  createPgBossJobQueue: () => ({
    publish: mockPublish,
    cancelByProject: mockCancelByProject,
  }),
}))
vi.mock("@/lib/infra/event-bus", () => ({
  publishEvent: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/infra/abort-registry", () => ({
  abortAllForProject: vi.fn(),
}))

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

describe("project-service", () => {
  let service: typeof import("@/lib/services/project-service")

  beforeAll(async () => {
    service = await import("@/lib/services/project-service")
  })

  describe("createProject", () => {
    it("应创建项目并正确解析多个目标", async () => {
      const project = await service.createProject({
        name: "多目标测试",
        targetInput: "http://example.com\n192.168.1.1, test.com",
        description: "集成测试",
      })

      expect(project.id).toBeDefined()
      expect(project.name).toBe("多目标测试")
      expect(project.targets).toHaveLength(3)

      // 验证目标类型识别
      const urlTarget = project.targets.find((t) => t.type === "url")
      expect(urlTarget).toBeDefined()
      expect(urlTarget!.value).toBe("http://example.com")

      const ipTarget = project.targets.find((t) => t.type === "ip")
      expect(ipTarget).toBeDefined()

      const domainTarget = project.targets.find((t) => t.type === "domain")
      expect(domainTarget).toBeDefined()
    })

    it("应自动生成 audit 日志", async () => {
      const project = await service.createProject({
        name: "审计测试",
        targetInput: "test.com",
      })

      const audits = await db.prisma.auditEvent.findMany({
        where: { projectId: project.id },
      })
      expect(audits).toHaveLength(1)
      expect(audits[0].action).toBe("created")
    })

    it("应识别 CIDR 格式目标", async () => {
      const project = await service.createProject({
        name: "CIDR 测试",
        targetInput: "10.0.0.0/24",
      })

      const cidrTarget = project.targets.find((t) => t.type === "cidr")
      expect(cidrTarget).toBeDefined()
      expect(cidrTarget!.value).toBe("10.0.0.0/24")
    })

    it("应过滤空行和空白", async () => {
      const project = await service.createProject({
        name: "空白过滤",
        targetInput: "  a.com  \n\n  \n  b.com  ",
      })

      expect(project.targets).toHaveLength(2)
    })
  })

  describe("listProjects", () => {
    it("应返回所有项目", async () => {
      await service.createProject({ name: "P1", targetInput: "a.com" })
      await service.createProject({ name: "P2", targetInput: "b.com" })

      const projects = await service.listProjects()
      expect(projects).toHaveLength(2)
    })
  })

  describe("getProject", () => {
    it("应返回项目详情", async () => {
      const created = await service.createProject({ name: "获取测试", targetInput: "x.com" })
      const project = await service.getProject(created.id)
      expect(project.name).toBe("获取测试")
    })

    it("不存在的项目应抛出 NotFoundError", async () => {
      await expect(service.getProject("nonexistent")).rejects.toThrow("not found")
    })
  })

  describe("startProject", () => {
    it("应将 idle 项目转为 executing 并发布 react_round 任务", async () => {
      const project = await service.createProject({ name: "启动测试", targetInput: "t.com" })

      const result = await service.startProject(project.id)
      expect(result.lifecycle).toBe("executing")

      // 验证数据库状态
      const found = await db.prisma.project.findUnique({ where: { id: project.id } })
      expect(found!.lifecycle).toBe("executing")

      // 验证 job 发布
      expect(mockPublish).toHaveBeenCalledWith(
        "react_round",
        expect.objectContaining({ projectId: project.id, round: 1 }),
        expect.any(Object),
      )

      // 验证 audit 日志（created + started）
      const audits = await db.prisma.auditEvent.findMany({
        where: { projectId: project.id },
        orderBy: { createdAt: "asc" },
      })
      expect(audits).toHaveLength(2)
      expect(audits[1].action).toBe("started")
    })

    it("failed 项目应可通过 RETRY_REACT 重新启动", async () => {
      const project = await service.createProject({ name: "重试测试", targetInput: "t.com" })
      // 手动将状态设为 failed
      await db.prisma.project.update({
        where: { id: project.id },
        data: { lifecycle: "failed" },
      })

      const result = await service.startProject(project.id)
      expect(result.lifecycle).toBe("executing")
    })
  })

  describe("stopProject", () => {
    it("应将 executing 项目转为 stopped", async () => {
      const project = await service.createProject({ name: "停止测试", targetInput: "t.com" })
      await service.startProject(project.id)

      const result = await service.stopProject(project.id)
      expect(result.lifecycle).toBe("stopped")

      // 验证数据库状态
      const found = await db.prisma.project.findUnique({ where: { id: project.id } })
      expect(found!.lifecycle).toBe("stopped")
    })

    it("应取消项目的 pending MCP 运行和审批", async () => {
      const project = await service.createProject({ name: "取消测试", targetInput: "t.com" })
      await service.startProject(project.id)

      // 创建 pending 的 mcpRun 和 approval
      const run = await db.prisma.mcpRun.create({
        data: {
          projectId: project.id,
          capability: "scan",
          toolName: "tool",
          target: "t",
          requestedAction: "a",
          riskLevel: "low",
          phase: "recon",
          round: 1,
          status: "pending",
        },
      })
      await db.prisma.approval.create({
        data: {
          projectId: project.id,
          mcpRunId: run.id,
          target: "t",
          actionType: "scan",
          riskLevel: "low",
          status: "pending",
        },
      })

      await service.stopProject(project.id)

      // 验证 mcpRun 被取消
      const foundRun = await db.prisma.mcpRun.findUnique({ where: { id: run.id } })
      expect(foundRun!.status).toBe("cancelled")

      // 验证 approval 被取消
      const foundApproval = await db.prisma.approval.findFirst({
        where: { projectId: project.id },
      })
      expect(foundApproval!.status).toBe("rejected")
    })
  })

  describe("deleteProject", () => {
    it("应删除项目并记录审计日志", async () => {
      const project = await service.createProject({ name: "删除测试", targetInput: "t.com" })
      await service.deleteProject(project.id)

      const found = await db.prisma.project.findUnique({ where: { id: project.id } })
      expect(found).toBeNull()

      // audit 日志中应有 deleted 记录（projectId 因 onDelete: SetNull 变为 null）
      const audits = await db.prisma.auditEvent.findMany({
        where: { action: "deleted" },
      })
      expect(audits.length).toBeGreaterThanOrEqual(1)
    })

    it("删除不存在的项目应抛出 NotFoundError", async () => {
      await expect(service.deleteProject("nonexistent")).rejects.toThrow("not found")
    })
  })
})
