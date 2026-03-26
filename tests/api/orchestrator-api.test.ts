import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PATCH as patchApproval } from "@/app/api/approvals/[approvalId]/route"
import { GET as getProjectContext } from "@/app/api/projects/[projectId]/context/route"
import { POST as postLocalValidation } from "@/app/api/projects/[projectId]/orchestrator/local-validation/route"
import { POST as postOrchestratorPlan } from "@/app/api/projects/[projectId]/orchestrator/plan/route"
import { GET as getProjectOperations } from "@/app/api/projects/[projectId]/operations/route"

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
    const planResponse = await postOrchestratorPlan(
      new Request("http://localhost/api/projects/proj-huayao/orchestrator/plan", {
        method: "POST",
        body: JSON.stringify({
          labId: "juice-shop",
          approvalScenario: "include-high-risk",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      buildProjectContext("proj-huayao"),
    )
    const planPayload = await planResponse.json()

    expect(planResponse.status).toBe(200)
    expect(planPayload.provider.enabled).toBe(false)
    expect(planPayload.plan.items.length).toBeGreaterThan(0)

    const operationsResponse = await getProjectOperations(
      new Request("http://localhost/api/projects/proj-huayao/operations"),
      buildProjectContext("proj-huayao"),
    )
    const operationsPayload = await operationsResponse.json()

    expect(operationsResponse.status).toBe(200)
    expect(operationsPayload.orchestrator.provider.provider).toBe("openai-compatible")
    expect(operationsPayload.orchestrator.localLabs.some((lab: { id: string }) => lab.id === "juice-shop")).toBe(true)
    expect(operationsPayload.orchestrator.lastPlan.summary).toContain("Juice Shop")
  })

  it("runs local validation, pauses on approval, and resumes after approval", async () => {
    const validationResponse = await postLocalValidation(
      new Request("http://localhost/api/projects/proj-huayao/orchestrator/local-validation", {
        method: "POST",
        body: JSON.stringify({
          labId: "juice-shop",
          approvalScenario: "include-high-risk",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      buildProjectContext("proj-huayao"),
    )
    const validationPayload = await validationResponse.json()

    expect(validationResponse.status).toBe(202)
    expect(validationPayload.status).toBe("waiting_approval")
    expect(validationPayload.plan.items.length).toBeGreaterThanOrEqual(3)
    expect(validationPayload.runs.some((item: { status: string }) => item.status === "已执行")).toBe(true)
    expect(validationPayload.runs.some((item: { status: string }) => item.status === "待审批")).toBe(true)
    expect(validationPayload.approval.status).toBe("待处理")

    const contextAfterDispatch = await getProjectContext(
      new Request("http://localhost/api/projects/proj-huayao/context"),
      buildProjectContext("proj-huayao"),
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
      new Request("http://localhost/api/projects/proj-huayao/context"),
      buildProjectContext("proj-huayao"),
    )
    const approvedPayload = await contextAfterApproval.json()

    expect(contextAfterApproval.status).toBe(200)
    expect(
      approvedPayload.detail.findings.some((item: { title: string }) => item.title.includes("认证绕过")),
    ).toBe(true)
  })
})
