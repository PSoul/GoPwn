import { createServer } from "node:http"
import { mkdtempSync, rmSync } from "node:fs"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PATCH as patchApproval } from "@/app/api/approvals/[approvalId]/route"
import { GET as getProjectContext } from "@/app/api/projects/[projectId]/context/route"
import { POST as postLocalValidation } from "@/app/api/projects/[projectId]/orchestrator/local-validation/route"
import { POST as postOrchestratorPlan } from "@/app/api/projects/[projectId]/orchestrator/plan/route"
import { GET as getProjectOperations } from "@/app/api/projects/[projectId]/operations/route"
import { resetLocalLabCatalogTestAdapters, setLocalLabCatalogTestAdapters } from "@/lib/local-lab-catalog"
import { registerStoredMcpServer } from "@/lib/mcp-server-repository"
import { createStoredProjectFixture, seedWorkflowReadyMcpTools } from "@/tests/helpers/project-fixtures"

const buildProjectContext = (projectId: string) => ({
  params: Promise.resolve({ projectId }),
})

const buildApprovalContext = (approvalId: string) => ({
  params: Promise.resolve({ approvalId }),
})

const nativeFetch = globalThis.fetch

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

      if (url.includes("127.0.0.1:3000") || url.includes("127.0.0.1:18080")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        } as Response
      }

      throw new Error(`Unexpected fetch in orchestrator api test: ${url}`)
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetLocalLabCatalogTestAdapters()
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("generates a fallback orchestrator plan and exposes it on the operations payload", async () => {
    seedWorkflowReadyMcpTools()
    const fixture = await createStoredProjectFixture()
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
  }, 15_000)

  it("runs local validation, pauses on approval, and resumes after approval", async () => {
    seedWorkflowReadyMcpTools()
    const fixture = await createStoredProjectFixture()
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

  it("continues project closure after approval resumes and lands on report export plus final conclusion", async () => {
    seedWorkflowReadyMcpTools()
    const fixture = await createStoredProjectFixture({
      targetInput: "http://127.0.0.1:3000",
      description: "审批恢复后需要继续把项目收束到最终结论。",
    })
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

    const operationsResponse = await getProjectOperations(
      new Request(`http://localhost/api/projects/${fixture.project.id}/operations`),
      buildProjectContext(fixture.project.id),
    )
    const operationsPayload = await operationsResponse.json()

    expect(operationsResponse.status).toBe(200)
    expect(operationsPayload.project.status).toBe("已完成")
    expect(operationsPayload.reportExport.latest).not.toBeNull()
    expect(operationsPayload.reportExport.latest.conclusionSummary).toContain("最终结论")
    expect(operationsPayload.detail.finalConclusion).not.toBeNull()
    expect(operationsPayload.detail.finalConclusion.summary).toContain("最终结论")
  })

  it("normalizes real-provider plans with markdown-wrapped JSON and near-match capability labels", async () => {
    seedWorkflowReadyMcpTools()
    const fixture = await createStoredProjectFixture()
    process.env.LLM_PROVIDER = "openai-compatible"
    process.env.LLM_BASE_URL = "https://api.siliconflow.cn/v1"
    process.env.LLM_API_KEY = "sk-test"
    process.env.LLM_ORCHESTRATOR_MODEL = "Pro/deepseek-ai/DeepSeek-V3.2"
    process.env.LLM_REVIEWER_MODEL = "Pro/deepseek-ai/DeepSeek-V3.2"

    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)

      if (url.includes("127.0.0.1:3000") || url.includes("127.0.0.1:18080")) {
        return {
          ok: true,
          status: 200,
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

  it("allows WebGoat local validation to proceed when only the container-internal probe is reachable", async () => {
    seedWorkflowReadyMcpTools()
    process.env.WEBGOAT_HOST_PORT = "18080"
    setLocalLabCatalogTestAdapters({
      fetch: vi.fn(async (input: string | URL | Request) => {
        const url = String(input)

        if (url.includes("127.0.0.1:3000")) {
          return new Response("", { status: 200 })
        }

        throw new Error(`connect ECONNREFUSED ${url}`)
      }) as typeof fetch,
      execFile: ((_file, args, callback) => {
        if (args.join(" ").includes("llm-pentest-webgoat")) {
          callback(null, { stdout: '{"status":"UP"}', stderr: "" })
          return {} as never
        }

        callback(new Error("unexpected docker exec"))
        return {} as never
      }) as never,
    })

    const fixture = await createStoredProjectFixture()
    const validationResponse = await postLocalValidation(
      new Request(`http://localhost/api/projects/${fixture.project.id}/orchestrator/local-validation`, {
        method: "POST",
        body: JSON.stringify({
          labId: "webgoat",
          approvalScenario: "none",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      buildProjectContext(fixture.project.id),
    )
    const validationPayload = await validationResponse.json()

    expect(validationResponse.status).toBe(200)
    expect(validationPayload.status).toBe("completed")
    expect(validationPayload.localLab.status).toBe("online")
    expect(validationPayload.localLab.availability).toBe("container")
    expect(validationPayload.localLab.statusNote).toContain("18080")
    expect(validationPayload.runs.some((item: { status: string }) => item.status === "已执行")).toBe(true)

    delete process.env.WEBGOAT_HOST_PORT
  })

  it("writes a real WebGoat actuator exposure finding after approval resumes", async () => {
    seedWorkflowReadyMcpTools()

    const targetServer = createServer((request, response) => {
      if (request.url === "/WebGoat/actuator/health") {
        response.writeHead(200, {
          "content-type": "application/json",
        })
        response.end(JSON.stringify({ status: "UP" }))
        return
      }

      if (request.url === "/WebGoat/actuator") {
        response.writeHead(200, {
          "content-type": "application/vnd.spring-boot.actuator.v3+json",
          server: "vitest-spring",
          "x-powered-by": "vitest-webgoat",
        })
        response.end(
          JSON.stringify({
            _links: {
              self: { href: "http://127.0.0.1/WebGoat/actuator" },
              health: { href: "http://127.0.0.1/WebGoat/actuator/health" },
              env: { href: "http://127.0.0.1/WebGoat/actuator/env" },
              configprops: { href: "http://127.0.0.1/WebGoat/actuator/configprops" },
            },
          }),
        )
        return
      }

      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
      })
      response.end("<html><head><title>WebGoat</title></head><body>ok</body></html>")
    })
    let startedTargetServer = false

    await new Promise<void>((resolve, reject) => {
      targetServer.once("error", reject)
      targetServer.listen(0, "127.0.0.1", () => {
        startedTargetServer = true
        resolve()
      })
    })

    const { port } = targetServer.address() as AddressInfo
    process.env.WEBGOAT_HOST_PORT = String(port)
    global.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)

      if (url.includes(`127.0.0.1:${port}`)) {
        return nativeFetch(input, init)
      }

      throw new Error(`Unexpected fetch in orchestrator api test: ${url}`)
    }) as unknown as typeof fetch

    await registerStoredMcpServer({
      serverName: "http-validation-stdio",
      version: "1.0.0",
      transport: "stdio",
      command: "node",
      args: ["scripts/mcp/http-validation-server.mjs"],
      endpoint: "stdio://http-validation-stdio",
      enabled: true,
      notes: "真实 HTTP 受控验证 MCP server",
      tools: [
        {
          toolName: "auth-guard-check",
          title: "HTTP 受控验证",
          description: "执行需要审批的高风险 HTTP 受控验证。",
          version: "1.0.0",
          capability: "受控验证类",
          boundary: "外部目标交互",
          riskLevel: "高",
          requiresApproval: true,
          resultMappings: ["findings", "evidence", "workLogs"],
          inputSchema: {
            type: "object",
            properties: {
              targetUrl: {
                type: "string",
              },
            },
            required: ["targetUrl"],
            additionalProperties: false,
          },
          outputSchema: {
            type: "object",
            properties: {
              responseSignals: {
                type: "array",
                items: {
                  type: "string",
                },
              },
            },
          },
          defaultConcurrency: "1",
          rateLimit: "2 req/min",
          timeout: "20s",
          retry: "1 次",
          owner: "测试夹具",
        },
      ],
    })

    try {
      const fixture = await createStoredProjectFixture({
        targetInput: `http://127.0.0.1:${port}/WebGoat`,
      })
      const validationResponse = await postLocalValidation(
        new Request(`http://localhost/api/projects/${fixture.project.id}/orchestrator/local-validation`, {
          method: "POST",
          body: JSON.stringify({
            labId: "webgoat",
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
      expect(
        validationPayload.plan.items.some(
          (item: { capability: string; target: string }) =>
            item.capability === "受控验证类" && item.target.endsWith("/WebGoat/actuator"),
        ),
      ).toBe(true)

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
      const contextPayload = await contextAfterApproval.json()

      expect(contextAfterApproval.status).toBe(200)
      expect(
        contextPayload.detail.findings.some(
          (item: { title: string; summary: string }) =>
            item.title.includes("Actuator") && item.summary.includes("匿名请求"),
        ),
      ).toBe(true)
      expect(
        contextPayload.evidence.some(
          (item: { source: string; verdict: string }) =>
            item.source === "受控验证类" && item.verdict.includes("Spring Actuator"),
        ),
      ).toBe(true)

      const operationsResponse = await getProjectOperations(
        new Request(`http://localhost/api/projects/${fixture.project.id}/operations`),
        buildProjectContext(fixture.project.id),
      )
      const operationsPayload = await operationsResponse.json()

      expect(operationsResponse.status).toBe(200)
      expect(
        operationsPayload.mcpRuns.some(
          (item: { toolName: string; connectorMode?: string; status: string }) =>
            item.toolName === "auth-guard-check" && item.connectorMode === "real" && item.status === "已执行",
        ),
      ).toBe(true)
    } finally {
      delete process.env.WEBGOAT_HOST_PORT

      if (startedTargetServer) {
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
  }, 15_000)

  it("drops provider-returned high-risk actions when approvalScenario is none", async () => {
    seedWorkflowReadyMcpTools()
    process.env.WEBGOAT_HOST_PORT = "18080"
    process.env.LLM_PROVIDER = "openai-compatible"
    process.env.LLM_BASE_URL = "https://api.siliconflow.cn/v1"
    process.env.LLM_API_KEY = "sk-test"
    process.env.LLM_ORCHESTRATOR_MODEL = "Pro/deepseek-ai/DeepSeek-V3.2"
    process.env.LLM_REVIEWER_MODEL = "Pro/deepseek-ai/DeepSeek-V3.2"

    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)

      if (url.includes("127.0.0.1:18080/WebGoat/actuator/health")) {
        return new Response("", { status: 200 })
      }

      if (url === "https://api.siliconflow.cn/v1/chat/completions") {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: "先做低风险入口探测，再补一条高风险登录验证。",
                    items: [
                      {
                        capability: "目标解析类",
                        requestedAction: "确认 WebGoat 首页可达",
                        target: "http://127.0.0.1:18080/WebGoat",
                        riskLevel: "low",
                        rationale: "建立低风险基线。",
                      },
                      {
                        capability: "Web 页面探测类",
                        requestedAction: "探测 WebGoat 登录页",
                        target: "http://127.0.0.1:18080/WebGoat/login",
                        riskLevel: "low",
                        rationale: "识别登录入口。",
                      },
                      {
                        capability: "受控验证类",
                        requestedAction: "尝试默认凭据登录",
                        target: "http://127.0.0.1:18080/WebGoat/login",
                        riskLevel: "high",
                        rationale: "验证默认口令。",
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        } as Response
      }

      throw new Error(`Unexpected fetch in orchestrator api test: ${url}`)
    }) as unknown as typeof fetch

    const fixture = await createStoredProjectFixture({
      targetInput: "http://127.0.0.1:18080/WebGoat",
    })
    const planResponse = await postOrchestratorPlan(
      new Request(`http://localhost/api/projects/${fixture.project.id}/orchestrator/plan`, {
        method: "POST",
        body: JSON.stringify({
          labId: "webgoat",
          approvalScenario: "none",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      buildProjectContext(fixture.project.id),
    )
    const planPayload = await planResponse.json()

    expect(planResponse.status).toBe(200)
    expect(planPayload.plan.items.some((item: { capability: string }) => item.capability === "受控验证类")).toBe(false)
    expect(planPayload.plan.items.every((item: { riskLevel: string }) => item.riskLevel !== "高")).toBe(true)

    delete process.env.WEBGOAT_HOST_PORT
  })
})
