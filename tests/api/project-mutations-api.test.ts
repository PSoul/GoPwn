import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { POST as archiveProject } from "@/app/api/projects/[projectId]/archive/route"
import { GET as getProjectDetail, PATCH as patchProject } from "@/app/api/projects/[projectId]/route"
import { GET as getProjects, POST as postProjects } from "@/app/api/projects/route"
import { GET as getAuditLogs } from "@/app/api/settings/audit-logs/route"

const PROJECT_ID_PATTERN = /^proj-\d{8}-[a-f0-9]{8}$/

const buildProjectContext = (projectId: string) => ({
  params: Promise.resolve({ projectId }),
})

const baseProjectInput = {
  name: "北栖支付开放暴露面初筛",
  seed: "open.beiqi-pay.cn",
  targetType: "domain",
  owner: "研究员席位 C",
  priority: "中",
  targetSummary: "open.beiqi-pay.cn / pay-gateway.beiqi-pay.cn / docs.beiqi-pay.cn",
  authorizationSummary: "仅执行匿名外网面识别、开放文档采样和低风险只读验证，不进入写操作。",
  scopeSummary: "主域及明确归属子域纳入；新增公网 IP、对象存储或第三方节点一律待确认。",
  forbiddenActions: "禁止无人审批的高风险动作；禁止越权登录后流程；禁止高频压测类操作。",
  defaultConcurrency: "项目级 2 / 高风险 1",
  rateLimit: "被动 100 req/min / 验证 10 req/min",
  timeout: "45s / 1 次重试",
  approvalMode: "高风险逐项审批，低风险自动执行",
  tags: "支付 / 匿名面 / 原型项目",
  deliveryNotes: "创建后先进入种子目标接收与持续信息收集阶段，并建立审批与证据链基线。",
}

describe("project mutation api routes", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-store-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
  })

  afterEach(() => {
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("creates a persisted project that is immediately visible in collection and detail routes", async () => {
    const createResponse = await postProjects(
      new Request("http://localhost/api/projects", {
        method: "POST",
        body: JSON.stringify(baseProjectInput),
        headers: { "content-type": "application/json" },
      }),
    )
    const createPayload = await createResponse.json()

    expect(createResponse.status).toBe(201)
    expect(createPayload.project.id).toMatch(PROJECT_ID_PATTERN)
    expect(createPayload.project.name).toBe(baseProjectInput.name)
    expect(createPayload.project.status).toBe("待处理")

    const listResponse = await getProjects()
    const listPayload = await listResponse.json()

    expect(listResponse.status).toBe(200)
    expect(listPayload.items.some((project: { id: string }) => project.id === createPayload.project.id)).toBe(true)

    const detailResponse = await getProjectDetail(
      new Request(`http://localhost/api/projects/${createPayload.project.id}`),
      buildProjectContext(createPayload.project.id),
    )
    const detailPayload = await detailResponse.json()

    expect(detailResponse.status).toBe(200)
    expect(detailPayload.project.name).toBe(baseProjectInput.name)
    expect(detailPayload.detail.currentStage.title).toBe("授权与范围定义")
  })

  it("updates a persisted project and keeps subsequent reads in sync", async () => {
    const createResponse = await postProjects(
      new Request("http://localhost/api/projects", {
        method: "POST",
        body: JSON.stringify(baseProjectInput),
        headers: { "content-type": "application/json" },
      }),
    )
    const createPayload = await createResponse.json()

    const patchResponse = await patchProject(
      new Request(`http://localhost/api/projects/${createPayload.project.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: "北栖支付开放资产复核",
          owner: "研究员席位 D",
          priority: "高",
          targetSummary: "open.beiqi-pay.cn / pay-gateway.beiqi-pay.cn / sandbox.beiqi-pay.cn",
        }),
        headers: { "content-type": "application/json" },
      }),
      buildProjectContext(createPayload.project.id),
    )
    const patchPayload = await patchResponse.json()

    expect(patchResponse.status).toBe(200)
    expect(patchPayload.project.name).toBe("北栖支付开放资产复核")
    expect(patchPayload.project.owner).toBe("研究员席位 D")
    expect(patchPayload.project.priority).toBe("高")

    const detailResponse = await getProjectDetail(
      new Request(`http://localhost/api/projects/${createPayload.project.id}`),
      buildProjectContext(createPayload.project.id),
    )
    const detailPayload = await detailResponse.json()

    expect(detailResponse.status).toBe(200)
    expect(detailPayload.project.targetSummary).toContain("sandbox.beiqi-pay.cn")
  })

  it("archives a persisted project and emits audit log records", async () => {
    const createResponse = await postProjects(
      new Request("http://localhost/api/projects", {
        method: "POST",
        body: JSON.stringify(baseProjectInput),
        headers: { "content-type": "application/json" },
      }),
    )
    const createPayload = await createResponse.json()

    const archiveResponse = await archiveProject(
      new Request(`http://localhost/api/projects/${createPayload.project.id}/archive`, { method: "POST" }),
      buildProjectContext(createPayload.project.id),
    )
    const archivePayload = await archiveResponse.json()

    expect(archiveResponse.status).toBe(200)
    expect(archivePayload.project.status).toBe("已完成")
    expect(archivePayload.project.tags).toContain("已归档")

    const auditResponse = await getAuditLogs()
    const auditPayload = await auditResponse.json()

    expect(auditResponse.status).toBe(200)
    expect(auditPayload.items[0].summary).toContain("归档")
    expect(auditPayload.items.some((log: { summary: string }) => log.summary.includes("创建项目"))).toBe(true)
    expect(auditPayload.items.some((log: { summary: string }) => log.summary.includes("归档项目"))).toBe(true)
  })
})
