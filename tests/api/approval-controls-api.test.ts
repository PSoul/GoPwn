import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { PATCH as patchApproval } from "@/app/api/approvals/[approvalId]/route"
import { PATCH as patchProjectApprovalControl } from "@/app/api/projects/[projectId]/approval-control/route"
import { GET as getProjectDetail } from "@/app/api/projects/[projectId]/route"
import { GET as getApprovalPolicy, PATCH as patchApprovalPolicy } from "@/app/api/settings/approval-policy/route"
import { GET as getAuditLogs } from "@/app/api/settings/audit-logs/route"
import { flushPendingKickoff } from "@/lib/compositions/control-compositions"
import { createStoredProjectFixture, createWorkflowFixture } from "@/tests/helpers/project-fixtures"

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
    const fixture = await createWorkflowFixture({ workflow: "with-approval" })
    const approvalId = fixture.approvals[0].id
    const response = await patchApproval(
      new Request(`http://localhost/api/approvals/${approvalId}`, {
        method: "PATCH",
        body: JSON.stringify({ decision: "已批准" }),
        headers: { "content-type": "application/json" },
      }),
      buildApprovalContext(approvalId),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.approval.status).toBe("已批准")
    await flushPendingKickoff()

    const projectResponse = await getProjectDetail(
      new Request(`http://localhost/api/projects/${fixture.project.id}`),
      buildProjectContext(fixture.project.id),
    )
    const projectPayload = await projectResponse.json()

    expect(projectResponse.status).toBe(200)
    expect(projectPayload.project.pendingApprovals).toBe(0)
    expect(projectPayload.detail.finalConclusion).not.toBeNull()
    expect(projectPayload.detail.currentStage.title).toBe("风险聚合与项目结论")

    const auditResponse = await getAuditLogs(
      new Request("http://localhost/api/settings/audit-logs"),
      { params: Promise.resolve({}) },
    )
    const auditPayload = await auditResponse.json()

    expect(auditResponse.status).toBe(200)
    expect(auditPayload.items.some((item: { summary: string }) => item.summary.includes(approvalId))).toBe(true)
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
      { params: Promise.resolve({}) },
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.approvalControl.enabled).toBe(false)
    expect(payload.approvalControl.note).toContain("临时关闭")

    const readResponse = await getApprovalPolicy(
      new Request("http://localhost/api/settings/approval-policy"),
      { params: Promise.resolve({}) },
    )
    const readPayload = await readResponse.json()

    expect(readResponse.status).toBe(200)
    expect(readPayload.approvalControl.enabled).toBe(false)
    expect(readPayload.approvalControl.autoApproveLowRisk).toBe(false)
  })

  it("persists project-level approval control updates", async () => {
    const fixture = await createStoredProjectFixture()
    const response = await patchProjectApprovalControl(
      new Request(`http://localhost/api/projects/${fixture.project.id}/approval-control`, {
        method: "PATCH",
        body: JSON.stringify({
          enabled: true,
          autoApproveLowRisk: false,
          note: "测试项目临时改为中高风险动作全部人工确认。",
        }),
        headers: { "content-type": "application/json" },
      }),
      buildProjectContext(fixture.project.id),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.detail.approvalControl.autoApproveLowRisk).toBe(false)
    expect(payload.detail.approvalControl.mode).toContain("中高风险")

    const detailResponse = await getProjectDetail(
      new Request(`http://localhost/api/projects/${fixture.project.id}`),
      buildProjectContext(fixture.project.id),
    )
    const detailPayload = await detailResponse.json()

    expect(detailResponse.status).toBe(200)
    expect(detailPayload.detail.approvalControl.note).toContain("全部人工确认")
  })
})
