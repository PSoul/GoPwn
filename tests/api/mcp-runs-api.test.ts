import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { PATCH as patchApproval } from "@/app/api/approvals/[approvalId]/route"
import { GET as getProjectDetail } from "@/app/api/projects/[projectId]/route"
import { GET as getProjectMcpRuns, POST as postProjectMcpRun } from "@/app/api/projects/[projectId]/mcp-runs/route"

const buildProjectContext = (projectId: string) => ({
  params: Promise.resolve({ projectId }),
})

const buildApprovalContext = (approvalId: string) => ({
  params: Promise.resolve({ approvalId }),
})

describe("project MCP run api routes", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-mcp-runs-store-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
  })

  afterEach(() => {
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("dispatches low-risk MCP actions immediately when approval is not required", async () => {
    const response = await postProjectMcpRun(
      new Request("http://localhost/api/projects/proj-huayao/mcp-runs", {
        method: "POST",
        body: JSON.stringify({
          capability: "DNS / 子域 / 证书情报类",
          requestedAction: "补采证书与子域情报",
          target: "admin.huayao.com",
          riskLevel: "低",
        }),
        headers: { "content-type": "application/json" },
      }),
      buildProjectContext("proj-huayao"),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.run.status).toBe("已执行")
    expect(payload.run.toolName).toBe("dns-census")

    const readResponse = await getProjectMcpRuns(
      new Request("http://localhost/api/projects/proj-huayao/mcp-runs"),
      buildProjectContext("proj-huayao"),
    )
    const readPayload = await readResponse.json()

    expect(readResponse.status).toBe(200)
    expect(readPayload.items[0].target).toBe("admin.huayao.com")
    expect(readPayload.items[0].summaryLines[0]).toContain("补采证书与子域情报")
  })

  it("queues high-risk MCP actions for approval and resumes them after approval", async () => {
    const dispatchResponse = await postProjectMcpRun(
      new Request("http://localhost/api/projects/proj-yunlan/mcp-runs", {
        method: "POST",
        body: JSON.stringify({
          capability: "受控验证类",
          requestedAction: "匿名鉴权绕过受控验证",
          target: "api.yunlanmed.com/v1",
          riskLevel: "高",
        }),
        headers: { "content-type": "application/json" },
      }),
      buildProjectContext("proj-yunlan"),
    )
    const dispatchPayload = await dispatchResponse.json()

    expect(dispatchResponse.status).toBe(202)
    expect(dispatchPayload.run.status).toBe("待审批")
    expect(dispatchPayload.approval.status).toBe("待处理")

    const projectResponse = await getProjectDetail(
      new Request("http://localhost/api/projects/proj-yunlan"),
      buildProjectContext("proj-yunlan"),
    )
    const projectPayload = await projectResponse.json()

    expect(projectResponse.status).toBe(200)
    expect(projectPayload.project.pendingApprovals).toBeGreaterThan(0)

    const approvalResponse = await patchApproval(
      new Request(`http://localhost/api/approvals/${dispatchPayload.approval.id}`, {
        method: "PATCH",
        body: JSON.stringify({ decision: "已批准" }),
        headers: { "content-type": "application/json" },
      }),
      buildApprovalContext(dispatchPayload.approval.id),
    )

    expect(approvalResponse.status).toBe(200)

    const readRunsResponse = await getProjectMcpRuns(
      new Request("http://localhost/api/projects/proj-yunlan/mcp-runs"),
      buildProjectContext("proj-yunlan"),
    )
    const readRunsPayload = await readRunsResponse.json()
    const resumedRun = readRunsPayload.items.find(
      (item: { linkedApprovalId?: string }) => item.linkedApprovalId === dispatchPayload.approval.id,
    )

    expect(readRunsResponse.status).toBe(200)
    expect(resumedRun.status).toBe("已执行")
    expect(resumedRun.summaryLines.at(-1)).toContain("审批已批准")
  })
})
