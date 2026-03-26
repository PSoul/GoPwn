import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { PATCH as patchApproval } from "@/app/api/approvals/[approvalId]/route"
import { PATCH as patchProjectApprovalControl } from "@/app/api/projects/[projectId]/approval-control/route"
import { GET as getProjectDetail } from "@/app/api/projects/[projectId]/route"
import { GET as getApprovalPolicy, PATCH as patchApprovalPolicy } from "@/app/api/settings/approval-policy/route"
import { GET as getAuditLogs } from "@/app/api/settings/audit-logs/route"

const buildApprovalContext = (approvalId: string) => ({
  params: Promise.resolve({ approvalId }),
})

const buildProjectContext = (projectId: string) => ({
  params: Promise.resolve({ projectId }),
})

describe("approval and control api routes", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-approval-store-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
  })

  afterEach(() => {
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("persists approval decisions and syncs project pending-approval counts", async () => {
    const response = await patchApproval(
      new Request("http://localhost/api/approvals/APR-20260326-015", {
        method: "PATCH",
        body: JSON.stringify({ decision: "已批准" }),
        headers: { "content-type": "application/json" },
      }),
      buildApprovalContext("APR-20260326-015"),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.approval.status).toBe("已批准")

    const projectResponse = await getProjectDetail(
      new Request("http://localhost/api/projects/proj-yunlan"),
      buildProjectContext("proj-yunlan"),
    )
    const projectPayload = await projectResponse.json()

    expect(projectResponse.status).toBe(200)
    expect(projectPayload.project.pendingApprovals).toBe(0)
    expect(projectPayload.detail.activity.some((item: { title: string }) => item.title.includes("APR-20260326-015"))).toBe(true)

    const auditResponse = await getAuditLogs()
    const auditPayload = await auditResponse.json()

    expect(auditResponse.status).toBe(200)
    expect(auditPayload.items.some((item: { summary: string }) => item.summary.includes("APR-20260326-015"))).toBe(true)
  })

  it("persists global approval policy updates", async () => {
    const response = await patchApprovalPolicy(
      new Request("http://localhost/api/settings/approval-policy", {
        method: "PATCH",
        body: JSON.stringify({
          enabled: false,
          autoApproveLowRisk: false,
          note: "临时关闭审批自动策略，等待人工复核。",
        }),
        headers: { "content-type": "application/json" },
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.approvalControl.enabled).toBe(false)
    expect(payload.approvalControl.note).toContain("临时关闭")

    const readResponse = await getApprovalPolicy()
    const readPayload = await readResponse.json()

    expect(readResponse.status).toBe(200)
    expect(readPayload.approvalControl.enabled).toBe(false)
    expect(readPayload.approvalControl.autoApproveLowRisk).toBe(false)
  })

  it("persists project-level approval control updates", async () => {
    const response = await patchProjectApprovalControl(
      new Request("http://localhost/api/projects/proj-huayao/approval-control", {
        method: "PATCH",
        body: JSON.stringify({
          enabled: true,
          autoApproveLowRisk: false,
          note: "华曜项目临时改为中高风险动作全部人工确认。",
        }),
        headers: { "content-type": "application/json" },
      }),
      buildProjectContext("proj-huayao"),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.detail.approvalControl.autoApproveLowRisk).toBe(false)
    expect(payload.project.approvalMode).toContain("中高风险")

    const detailResponse = await getProjectDetail(
      new Request("http://localhost/api/projects/proj-huayao"),
      buildProjectContext("proj-huayao"),
    )
    const detailPayload = await detailResponse.json()

    expect(detailResponse.status).toBe(200)
    expect(detailPayload.detail.approvalControl.note).toContain("全部人工确认")
  })
})
