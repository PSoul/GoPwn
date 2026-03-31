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
  targetInput: "open.beiqi-pay.cn\npay-gateway.beiqi-pay.cn\ndocs.beiqi-pay.cn",
  description: "创建后先进入种子目标接收与持续信息收集阶段，并建立审批与证据链基线。",
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
      { params: Promise.resolve({}) },
    )
    const createPayload = await createResponse.json()

    expect(createResponse.status).toBe(201)
    expect(createPayload.project.id).toMatch(PROJECT_ID_PATTERN)
    expect(createPayload.project.name).toBe(baseProjectInput.name)
    expect(createPayload.project.status).toBe("待启动")

    const listResponse = await getProjects(
      new Request("http://localhost/api/projects"),
      { params: Promise.resolve({}) },
    )
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
    expect(detailPayload.detail.currentStage.title).toBe("种子目标接收")
  })

  it("updates a persisted project and keeps subsequent reads in sync", async () => {
    const createResponse = await postProjects(
      new Request("http://localhost/api/projects", {
        method: "POST",
        body: JSON.stringify(baseProjectInput),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({}) },
    )
    const createPayload = await createResponse.json()

    const patchResponse = await patchProject(
      new Request(`http://localhost/api/projects/${createPayload.project.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: "北栖支付开放资产复核",
          targetInput: "open.beiqi-pay.cn\npay-gateway.beiqi-pay.cn\nsandbox.beiqi-pay.cn",
          description: "更新后的项目说明，纳入 sandbox 入口并继续观察结果同步。",
        }),
        headers: { "content-type": "application/json" },
      }),
      buildProjectContext(createPayload.project.id),
    )
    const patchPayload = await patchResponse.json()

    expect(patchResponse.status).toBe(200)
    expect(patchPayload.project.name).toBe("北栖支付开放资产复核")
    expect(patchPayload.project.targets).toContain("sandbox.beiqi-pay.cn")
    expect(patchPayload.project.description).toContain("更新后的项目说明")

    const detailResponse = await getProjectDetail(
      new Request(`http://localhost/api/projects/${createPayload.project.id}`),
      buildProjectContext(createPayload.project.id),
    )
    const detailPayload = await detailResponse.json()

    expect(detailResponse.status).toBe(200)
    expect(detailPayload.project.targetInput).toContain("sandbox.beiqi-pay.cn")
  })

  it("archives a persisted project and emits audit log records", async () => {
    const createResponse = await postProjects(
      new Request("http://localhost/api/projects", {
        method: "POST",
        body: JSON.stringify(baseProjectInput),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({}) },
    )
    const createPayload = await createResponse.json()

    const archiveResponse = await archiveProject(
      new Request(`http://localhost/api/projects/${createPayload.project.id}/archive`, { method: "POST" }),
      buildProjectContext(createPayload.project.id),
    )
    const archivePayload = await archiveResponse.json()

    expect(archiveResponse.status).toBe(200)
    expect(archivePayload.project.status).toBe("已完成")
    expect(archivePayload.project.stage).toBe("报告与回归验证")

    const auditResponse = await getAuditLogs(
      new Request("http://localhost/api/settings/audit-logs"),
      { params: Promise.resolve({}) },
    )
    const auditPayload = await auditResponse.json()

    expect(auditResponse.status).toBe(200)
    expect(auditPayload.items.some((log: { summary: string }) => log.summary.includes("创建项目"))).toBe(true)
    expect(auditPayload.items.some((log: { summary: string }) => log.summary.includes("归档项目"))).toBe(true)
  })
})
