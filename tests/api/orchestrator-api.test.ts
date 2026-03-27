import { createServer } from "node:http"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PATCH as patchApproval } from "@/app/api/approvals/[approvalId]/route"
import { GET as getProjectContext } from "@/app/api/projects/[projectId]/context/route"
import { POST as postLocalValidation } from "@/app/api/projects/[projectId]/orchestrator/local-validation/route"
import { POST as postOrchestratorPlan } from "@/app/api/projects/[projectId]/orchestrator/plan/route"
import { GET as getProjectOperations } from "@/app/api/projects/[projectId]/operations/route"
import { createStoredProjectFixture, seedWorkflowReadyMcpTools } from "@/tests/helpers/project-fixtures"

const buildProjectContext = (projectId: string) => ({
  params: Promise.resolve({ projectId }),
})

const buildApprovalContext = (approvalId: string) => ({
  params: Promise.resolve({ approvalId }),
})

describe("project orchestrator api routes", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-orchestrator-store-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
    delete process.env.LLM_PROVIDER
    delete process.env.LLM_BASE_URL
    delete process.env.LLM_API_KEY
    delete process.env.LLM_ORCHESTRATOR_MODEL
    delete process.env.LLM_REVIEWER_MODEL
    delete process.env.LLM_TIMEOUT_MS

    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)

      if (url.includes("127.0.0.1:3000") || url.includes("127.0.0.1:8080")) {
        return {
          ok: true,
          json: async () => ({}),
        } as Response
      }

      throw new Error(`Unexpected fetch in orchestrator api test: ${url}`)
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("generates a fallback orchestrator plan and exposes it on the operations payload", async () => {
    seedWorkflowReadyMcpTools()
    const fixture = createStoredProjectFixture()
    const planResponse = await postOrchestratorPlan(
      new Request(`http://localhost/api/projects/${fixture.project.id}/orchestrator/plan`, {
        method: "POST",
        body: JSON.stringify({
          labId: "juice-shop",
          approvalScenario: "include-high-risk",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      buildProjectContext(fixture.project.id),
    )
    const planPayload = await planResponse.json()

    expect(planResponse.status).toBe(200)
    expect(planPayload.provider.enabled).toBe(false)
    expect(planPayload.plan.items.length).toBeGreaterThan(0)

    const operationsResponse = await getProjectOperations(
      new Request(`http://localhost/api/projects/${fixture.project.id}/operations`),
      buildProjectContext(fixture.project.id),
    )
    const operationsPayload = await operationsResponse.json()

    expect(operationsResponse.status).toBe(200)
    expect(operationsPayload.orchestrator.provider.provider).toBe("openai-compatible")
    expect(operationsPayload.orchestrator.localLabs.some((lab: { id: string }) => lab.id === "juice-shop")).toBe(true)
    expect(operationsPayload.orchestrator.lastPlan.summary).toContain("Juice Shop")
  })

  it("runs local validation, pauses on approval, and resumes after approval", async () => {
    seedWorkflowReadyMcpTools()
    const fixture = createStoredProjectFixture()
    const validationResponse = await postLocalValidation(
      new Request(`http://localhost/api/projects/${fixture.project.id}/orchestrator/local-validation`, {
        method: "POST",
        body: JSON.stringify({
          labId: "juice-shop",
          approvalScenario: "include-high-risk",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      buildProjectContext(fixture.project.id),
    )
    const validationPayload = await validationResponse.json()

    expect(validationResponse.status).toBe(202)
    expect(validationPayload.status).toBe("waiting_approval")
    expect(validationPayload.plan.items.length).toBeGreaterThanOrEqual(3)
    expect(validationPayload.runs.some((item: { status: string }) => item.status === "已执行")).toBe(true)
    expect(validationPayload.runs.some((item: { status: string }) => item.status === "待审批")).toBe(true)
    expect(validationPayload.approval.status).toBe("待处理")

    const contextAfterDispatch = await getProjectContext(
      new Request(`http://localhost/api/projects/${fixture.project.id}/context`),
      buildProjectContext(fixture.project.id),
    )
    const contextPayload = await contextAfterDispatch.json()

    expect(contextAfterDispatch.status).toBe(200)
    expect(contextPayload.assets.length).toBeGreaterThan(0)
    expect(contextPayload.evidence.length).toBeGreaterThan(0)

    const approvalResponse = await patchApproval(
      new Request(`http://localhost/api/approvals/${validationPayload.approval.id}`, {
        method: "PATCH",
        body: JSON.stringify({ decision: "已批准" }),
        headers: {
          "content-type": "application/json",
        },
      }),
      buildApprovalContext(validationPayload.approval.id),
    )

    expect(approvalResponse.status).toBe(200)

    const contextAfterApproval = await getProjectContext(
      new Request(`http://localhost/api/projects/${fixture.project.id}/context`),
      buildProjectContext(fixture.project.id),
    )
    const approvedPayload = await contextAfterApproval.json()

    expect(contextAfterApproval.status).toBe(200)
    expect(
      approvedPayload.detail.findings.some((item: { title: string }) => item.title.includes("认证绕过")),
    ).toBe(true)
  })

  it("normalizes real-provider plans with markdown-wrapped JSON and near-match capability labels", async () => {
    seedWorkflowReadyMcpTools()
    const fixture = createStoredProjectFixture()
    process.env.LLM_PROVIDER = "openai-compatible"
    process.env.LLM_BASE_URL = "https://api.siliconflow.cn/v1"
    process.env.LLM_API_KEY = "sk-test"
    process.env.LLM_ORCHESTRATOR_MODEL = "Pro/deepseek-ai/DeepSeek-V3.2"
    process.env.LLM_REVIEWER_MODEL = "Pro/deepseek-ai/DeepSeek-V3.2"

    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)

      if (url.includes("127.0.0.1:3000") || url.includes("127.0.0.1:8080")) {
        return {
          ok: true,
          json: async () => ({}),
        } as Response
      }

      if (url === "https://api.siliconflow.cn/v1/chat/completions") {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: [
                    "```json",
                    JSON.stringify({
                      summary: "先做 Web 指纹识别，再追加一条需要人工确认的高风险验证。",
                      items: [
                        {
                          capability: "Web 指纹识别类",
                          requestedAction: "识别 Juice Shop 首页响应特征",
                          target: "http://127.0.0.1:3000",
                          riskLevel: "medium",
                          rationale: "先确认首页入口、标题和响应头。",
                        },
                        {
                          capability: "高风险验证",
                          requestedAction: "尝试登录绕过验证",
                          target: "http://127.0.0.1:3000/login",
                          riskLevel: "high",
                          rationale: "保留一条需要审批的验证动作，检查审批恢复链路。",
                        },
                      ],
                    }),
                    "```",
                  ].join("\n"),
                },
              },
            ],
          }),
        } as Response
      }

      throw new Error(`Unexpected fetch in orchestrator api test: ${url}`)
    }) as unknown as typeof fetch

    const targetServer = createServer((_request, response) => {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "x-powered-by": "vitest-local-lab",
      })
      response.end("<html><head><title>Juice Shop Local Test</title></head><body>ok</body></html>")
    })
    let startedLocalServer = false

    await new Promise<void>((resolve, reject) => {
      targetServer.once("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
          resolve()
          return
        }

        reject(error)
      })
      targetServer.listen(3000, "127.0.0.1", () => {
        startedLocalServer = true
        resolve()
      })
    })

    try {
      const validationResponse = await postLocalValidation(
        new Request(`http://localhost/api/projects/${fixture.project.id}/orchestrator/local-validation`, {
          method: "POST",
          body: JSON.stringify({
            labId: "juice-shop",
            approvalScenario: "include-high-risk",
          }),
          headers: {
            "content-type": "application/json",
          },
        }),
        buildProjectContext(fixture.project.id),
      )
      const validationPayload = await validationResponse.json()

      expect(validationResponse.status).toBe(202)
      expect(validationPayload.provider.enabled).toBe(true)
      expect(validationPayload.status).toBe("waiting_approval")
      expect(validationPayload.plan.items[0].capability).toBe("Web 页面探测类")
      expect(validationPayload.plan.items[0].riskLevel).toBe("低")
      expect(
        validationPayload.plan.items
          .filter((item: { capability: string }) => item.capability === "Web 页面探测类")
          .every((item: { riskLevel: string }) => item.riskLevel === "低"),
      ).toBe(true)
      expect(validationPayload.plan.items.some((item: { capability: string; riskLevel: string }) => item.capability === "受控验证类" && item.riskLevel === "高")).toBe(true)
      expect(validationPayload.runs.some((item: { capability: string; status: string }) => item.capability === "Web 页面探测类" && item.status === "已执行")).toBe(true)
      expect(validationPayload.runs.some((item: { capability: string; status: string }) => item.capability === "受控验证类" && item.status === "待审批")).toBe(true)
    } finally {
      if (startedLocalServer) {
        await new Promise<void>((resolve, reject) => {
          targetServer.close((error) => {
            if (error) {
              reject(error)
              return
            }

            resolve()
          })
        })
      }
    }
  })
})
