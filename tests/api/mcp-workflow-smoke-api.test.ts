import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GET as getProjectContext } from "@/app/api/projects/[projectId]/context/route"
import { POST as postWorkflowSmokeRun } from "@/app/api/projects/[projectId]/mcp-workflow/smoke-run/route"
import { GET as getProjectMcpRuns } from "@/app/api/projects/[projectId]/mcp-runs/route"
import { GET as getWorkLogs } from "@/app/api/settings/work-logs/route"
import { createStoredProjectFixture, seedWorkflowReadyMcpTools } from "@/tests/helpers/project-fixtures"

const buildProjectContext = (projectId: string) => ({
  params: Promise.resolve({ projectId }),
})

describe("project MCP workflow smoke api route", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-mcp-workflow-store-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
  })

  afterEach(() => {
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("completes the baseline local MCP workflow with foundational tools", async () => {
    seedWorkflowReadyMcpTools()
    const fixture = createStoredProjectFixture()
    const response = await postWorkflowSmokeRun(
      new Request(`http://localhost/api/projects/${fixture.project.id}/mcp-workflow/smoke-run`, {
        method: "POST",
        body: JSON.stringify({ scenario: "baseline" }),
        headers: { "content-type": "application/json" },
      }),
      buildProjectContext(fixture.project.id),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.status).toBe("completed")
    expect(payload.outputs.normalizedTargets.length).toBeGreaterThan(0)
    expect(payload.outputs.discoveredSubdomains.length).toBeGreaterThan(0)
    expect(payload.outputs.webEntries.length).toBeGreaterThan(0)
    expect(payload.outputs.reportDigest.length).toBeGreaterThan(0)

    const runsResponse = await getProjectMcpRuns(
      new Request(`http://localhost/api/projects/${fixture.project.id}/mcp-runs`),
      buildProjectContext(fixture.project.id),
    )
    const runsPayload = await runsResponse.json()

    expect(runsResponse.status).toBe(200)
    expect(runsPayload.items.slice(0, 4).every((item: { status: string }) => item.status === "已执行")).toBe(true)

    const contextResponse = await getProjectContext(
      new Request(`http://localhost/api/projects/${fixture.project.id}/context`),
      buildProjectContext(fixture.project.id),
    )
    const contextPayload = await contextResponse.json()

    expect(contextResponse.status).toBe(200)
    expect(contextPayload.assets.length).toBeGreaterThan(0)
    expect(contextPayload.evidence.length).toBeGreaterThan(0)
    expect(contextPayload.detail.assetGroups.some((group: { count: string }) => group.count !== "0 项")).toBe(true)

    const workLogsResponse = await getWorkLogs()
    const workLogsPayload = await workLogsResponse.json()

    expect(workLogsResponse.status).toBe(200)
    expect(workLogsPayload.items.some((item: { category: string }) => item.category === "报告导出")).toBe(true)
  })

  it("halts the approval scenario at the high-risk MCP step", async () => {
    seedWorkflowReadyMcpTools()
    const fixture = createStoredProjectFixture()
    const response = await postWorkflowSmokeRun(
      new Request(`http://localhost/api/projects/${fixture.project.id}/mcp-workflow/smoke-run`, {
        method: "POST",
        body: JSON.stringify({ scenario: "with-approval" }),
        headers: { "content-type": "application/json" },
      }),
      buildProjectContext(fixture.project.id),
    )
    const payload = await response.json()

    expect(response.status).toBe(202)
    expect(payload.status).toBe("waiting_approval")
    expect(payload.blockedRun.status).toBe("待审批")
    expect(payload.approval.status).toBe("待处理")
    expect(payload.outputs.webEntries.length).toBeGreaterThan(0)
  })
})
