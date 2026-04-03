import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ProjectOrchestratorPanel } from "@/components/projects/project-orchestrator-panel"
import type { ProjectOrchestratorPanelPayload } from "@/lib/prototype-types"

const initialPayload: ProjectOrchestratorPanelPayload = {
  provider: {
    provider: "openai-compatible",
    enabled: false,
    baseUrl: "",
    orchestratorModel: "",
    reviewerModel: "",
    analyzerModel: "",
    note: "当前未接入真实 LLM，将使用本地回退编排。",
  },
  localLabs: [
    {
      id: "juice-shop",
      name: "OWASP Juice Shop",
      description: "本地 Web/API 靶场",
      baseUrl: "http://127.0.0.1:3000",
      healthUrl: "http://127.0.0.1:3000",
      image: "bkimminich/juice-shop",
      ports: ["127.0.0.1:3000->3000"],
      status: "unknown",
      availability: "unknown",
      statusNote: "",
    },
  ],
  lastPlan: null,
}

describe("ProjectOrchestratorPanel", () => {
  beforeEach(() => {
    global.fetch = vi.fn() as unknown as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("generates a plan for the selected local lab and updates the panel", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        provider: initialPayload.provider,
        plan: {
          generatedAt: "2026-03-26 23:40",
          provider: "openai-compatible",
          summary: "已为 OWASP Juice Shop 生成最小闭环验证计划。",
          items: [
            {
              capability: "目标解析类",
              requestedAction: "标准化本地靶场目标",
              target: "http://127.0.0.1:3000",
              riskLevel: "低",
              rationale: "先把入口归一化。",
            },
          ],
        },
      }),
    } as Response)

    render(<ProjectOrchestratorPanel projectId="proj-huayao" initialPayload={initialPayload} />)

    fireEvent.click(screen.getByRole("button", { name: "为 OWASP Juice Shop 生成计划" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/projects/proj-huayao/orchestrator/plan",
        expect.objectContaining({
          method: "POST",
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText("已为 OWASP Juice Shop 生成最小闭环验证计划。")).toBeInTheDocument()
    })
  })

  it("runs local validation and surfaces the waiting approval state", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        provider: initialPayload.provider,
        localLab: {
          ...initialPayload.localLabs[0],
          status: "online",
        },
        plan: {
          generatedAt: "2026-03-26 23:41",
          provider: "openai-compatible",
          summary: "已为 OWASP Juice Shop 生成最小闭环验证计划。",
          items: [
            {
              capability: "受控验证类",
              requestedAction: "受控登录绕过验证",
              target: "http://127.0.0.1:3000/login",
              riskLevel: "高",
              rationale: "验证审批阻塞链路。",
            },
          ],
        },
        runs: [
          {
            id: "run-approval",
            projectId: "proj-huayao",
            projectName: "华曜科技匿名外网面梳理",
            capability: "受控验证类",
            toolId: "mcp-02",
            toolName: "auth-guard-check",
            requestedAction: "受控登录绕过验证",
            target: "http://127.0.0.1:3000/login",
            riskLevel: "高",
            boundary: "外部目标交互",
            dispatchMode: "审批后执行",
            status: "待审批",
            requestedBy: "LLM 编排内核",
            createdAt: "2026-03-26 23:41",
            updatedAt: "2026-03-26 23:41",
            linkedApprovalId: "APR-001",
            summaryLines: ["等待审批。"],
          },
        ],
        approval: {
          id: "APR-001",
          status: "待处理",
        },
        status: "waiting_approval",
      }),
    } as Response)

    render(<ProjectOrchestratorPanel projectId="proj-huayao" initialPayload={initialPayload} />)

    fireEvent.click(screen.getByRole("button", { name: "运行 OWASP Juice Shop 本地验证" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/projects/proj-huayao/orchestrator/local-validation",
        expect.objectContaining({
          method: "POST",
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/APR-001/)).toBeInTheDocument()
      expect(screen.getByText(/等待审批/)).toBeInTheDocument()
    })
  })

  it("disables planning controls when the project is already in a terminal read-only state", () => {
    render(
      <ProjectOrchestratorPanel
        projectId="proj-huayao"
        initialPayload={initialPayload}
        readOnlyReason="当前项目已完成当前轮次，如需继续扩展测试，请新建下一轮项目。"
      />,
    )

    expect(screen.getByText("当前项目已完成当前轮次，如需继续扩展测试，请新建下一轮项目。")).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: /审批演练开关/ })).toBeDisabled()
    expect(screen.getByRole("button", { name: "为 OWASP Juice Shop 生成计划" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "运行 OWASP Juice Shop 本地验证" })).toBeDisabled()
  })
})
