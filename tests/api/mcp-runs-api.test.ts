import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { PATCH as patchApproval } from "@/app/api/approvals/[approvalId]/route"
import { GET as getProjectContext } from "@/app/api/projects/[projectId]/context/route"
import { GET as getProjectDetail } from "@/app/api/projects/[projectId]/route"
import { GET as getProjectMcpRuns, POST as postProjectMcpRun } from "@/app/api/projects/[projectId]/mcp-runs/route"
import { GET as getWorkLogs } from "@/app/api/settings/work-logs/route"
import {
  createStoredProjectFixture,
  seedWorkflowReadyMcpTools,
  workflowReadyMcpToolFixtures,
} from "@/tests/helpers/project-fixtures"
import { getProjectPrimaryTarget } from "@/lib/project-targets"

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
    await seedWorkflowReadyMcpTools()
    const fixture = await createStoredProjectFixture()
    const response = await postProjectMcpRun(
      new Request(`http://localhost/api/projects/${fixture.project.id}/mcp-runs`, {
        method: "POST",
        body: JSON.stringify({
          capability: "DNS / 子域 / 证书情报类",
          requestedAction: "补采证书与子域情报",
          target: getProjectPrimaryTarget(fixture.project),
          riskLevel: "低",
        }),
        headers: { "content-type": "application/json" },
      }),
      buildProjectContext(fixture.project.id),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.run.status).toBe("已执行")
    expect(payload.run.toolName).toBe("dns-census")

    const readResponse = await getProjectMcpRuns(
      new Request(`http://localhost/api/projects/${fixture.project.id}/mcp-runs`),
      buildProjectContext(fixture.project.id),
    )
    const readPayload = await readResponse.json()

    expect(readResponse.status).toBe(200)
    expect(readPayload.items[0].target).toBe(getProjectPrimaryTarget(fixture.project))
    expect(readPayload.items[0].summaryLines[0]).toContain("补采证书与子域情报")

    const contextResponse = await getProjectContext(
      new Request(`http://localhost/api/projects/${fixture.project.id}/context`),
      buildProjectContext(fixture.project.id),
    )
    const contextPayload = await contextResponse.json()

    expect(contextResponse.status).toBe(200)
    expect(contextPayload.evidence.some((item: { title: string }) => item.title === "被动域名与子域情报回流")).toBe(true)

    const workLogsResponse = await getWorkLogs(
      new Request("http://localhost/api/settings/work-logs"),
      { params: Promise.resolve({}) },
    )
    const workLogsPayload = await workLogsResponse.json()

    expect(workLogsResponse.status).toBe(200)
    expect(workLogsPayload.items.some((item: { actor: string }) => item.actor === "dns-census")).toBe(true)
  })

  it("queues high-risk MCP actions for approval and resumes them after approval", async () => {
    await seedWorkflowReadyMcpTools()
    const fixture = await createStoredProjectFixture()
    const dispatchResponse = await postProjectMcpRun(
      new Request(`http://localhost/api/projects/${fixture.project.id}/mcp-runs`, {
        method: "POST",
        body: JSON.stringify({
          capability: "受控验证类",
          requestedAction: "匿名鉴权绕过受控验证",
          target: "https://localhost/login",
          riskLevel: "高",
        }),
        headers: { "content-type": "application/json" },
      }),
      buildProjectContext(fixture.project.id),
    )
    const dispatchPayload = await dispatchResponse.json()

    expect(dispatchResponse.status).toBe(202)
    expect(dispatchPayload.run.status).toBe("待审批")
    expect(dispatchPayload.approval.status).toBe("待处理")

    const projectResponse = await getProjectDetail(
      new Request(`http://localhost/api/projects/${fixture.project.id}`),
      buildProjectContext(fixture.project.id),
    )
    const projectPayload = await projectResponse.json()

    expect(projectResponse.status).toBe(200)
    expect(projectPayload.project.pendingApprovals).toBeGreaterThan(0)

    // Stop the scheduler lifecycle to prevent the approval handler from triggering
    // a full multi-round orchestration kickoff that can exceed the test timeout.
    // The drain still executes the linked run thanks to ignoreProjectLifecycle.
    const { prisma: testPrisma } = await import("@/lib/prisma")
    await testPrisma.projectSchedulerControl.updateMany({
      where: { projectId: fixture.project.id },
      data: { lifecycle: "stopped" },
    })

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
      new Request(`http://localhost/api/projects/${fixture.project.id}/mcp-runs`),
      buildProjectContext(fixture.project.id),
    )
    const readRunsPayload = await readRunsResponse.json()
    const resumedRun = readRunsPayload.items.find(
      (item: { linkedApprovalId?: string }) => item.linkedApprovalId === dispatchPayload.approval.id,
    )

    expect(readRunsResponse.status).toBe(200)
    expect(resumedRun.status).toBe("已执行")
    expect(resumedRun.summaryLines.at(-1)).toContain("审批已批准")

    const contextResponse = await getProjectContext(
      new Request(`http://localhost/api/projects/${fixture.project.id}/context`),
      buildProjectContext(fixture.project.id),
    )
    const contextPayload = await contextResponse.json()

    expect(contextResponse.status).toBe(200)
    expect(contextPayload.detail.findings.some((item: { title: string }) => item.title.includes("鉴权"))).toBe(true)
    expect(contextPayload.evidence.some((item: { source: string }) => item.source === "受控验证类")).toBe(true)
    expect(contextPayload.assets.some((item: { label: string }) => item.label === "https://localhost/login")).toBe(true)
  })

  it("prefers the enabled tool whose metadata best matches the requested action within one capability", async () => {
    await seedWorkflowReadyMcpTools([
      ...workflowReadyMcpToolFixtures,
      {
        id: "tool-http-request-workbench",
        capability: "HTTP / API 结构发现类",
        toolName: "http-request-workbench",
        version: "1.0.0",
        riskLevel: "中",
        status: "启用",
        category: "HTTP 工作台",
        description: "发送自定义 HTTP 请求报文，返回状态、响应头、响应体摘要与证据。",
        inputMode: "json",
        outputMode: "json",
        boundary: "外部目标交互",
        requiresApproval: false,
        endpoint: "mcp://http-request-workbench",
        owner: "测试夹具",
        defaultConcurrency: "1",
        rateLimit: "10 req/min",
        timeout: "20s",
        retry: "1 次",
        lastCheck: "2026-03-27 10:00",
        notes: "适合发送自定义 HTTP 报文与结构化回包。",
      },
      {
        id: "tool-http-path-prober",
        capability: "HTTP / API 结构发现类",
        toolName: "http-path-prober",
        version: "1.0.0",
        riskLevel: "中",
        status: "启用",
        category: "路径探测",
        description: "批量探测常见路径和 API 文档暴露面。",
        inputMode: "json",
        outputMode: "json",
        boundary: "外部目标交互",
        requiresApproval: false,
        endpoint: "mcp://http-path-prober",
        owner: "测试夹具",
        defaultConcurrency: "1",
        rateLimit: "10 req/min",
        timeout: "20s",
        retry: "1 次",
        lastCheck: "2026-03-27 10:00",
        notes: "适合目录和路径探测。",
      },
    ])
    const fixture = await createStoredProjectFixture()
    const response = await postProjectMcpRun(
      new Request(`http://localhost/api/projects/${fixture.project.id}/mcp-runs`, {
        method: "POST",
        body: JSON.stringify({
          capability: "HTTP / API 结构发现类",
          requestedAction: "发送自定义 HTTP 请求报文",
          target: "http://127.0.0.1:18080/WebGoat",
          riskLevel: "高",
        }),
        headers: { "content-type": "application/json" },
      }),
      buildProjectContext(fixture.project.id),
    )
    const payload = await response.json()

    expect(response.status).toBe(202)
    expect(payload.run.status).toBe("待审批")
    expect(payload.run.toolName).toBe("http-request-workbench")
  })
})
