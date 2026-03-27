import { cleanup, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import ApprovalPolicySettingsPage from "@/app/(console)/settings/approval-policy/page"
import AuditLogsSettingsPage from "@/app/(console)/settings/audit-logs/page"
import EvidencePage from "@/app/(console)/evidence/page"
import EvidenceDetailPage from "@/app/(console)/evidence/[evidenceId]/page"
import LlmSettingsPage from "@/app/(console)/settings/llm/page"
import McpToolsSettingsPage from "@/app/(console)/settings/mcp-tools/page"
import SettingsPage from "@/app/(console)/settings/page"
import SystemStatusSettingsPage from "@/app/(console)/settings/system-status/page"
import WorkLogsSettingsPage from "@/app/(console)/settings/work-logs/page"
import { createWorkflowFixture } from "@/tests/helpers/project-fixtures"

describe("Evidence and settings pages", () => {
  it("renders the evidence list and detail flow", async () => {
    const fixture = await createWorkflowFixture()
    render(<EvidencePage />)
    expect(screen.getByText("证据与结果")).toBeInTheDocument()
    cleanup()

    render(await EvidenceDetailPage({ params: Promise.resolve({ evidenceId: fixture.evidence[0].id }) }))
    expect(screen.getByText("原始输出")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: `证据详情 · ${fixture.evidence[0].id}` })).toBeInTheDocument()
  })

  it("renders the settings hub", () => {
    render(<SettingsPage />)
    expect(screen.getByRole("heading", { name: "设置分类" })).toBeInTheDocument()
    expect(screen.getAllByText("MCP 工具管理").length).toBeGreaterThan(0)
    expect(screen.getAllByText("LLM 设置").length).toBeGreaterThan(0)
    expect(screen.getAllByText("工作日志").length).toBeGreaterThan(0)
  })

  it("renders the split settings subpages", () => {
    render(<McpToolsSettingsPage />)
    expect(screen.getAllByText("MCP 工具管理").length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "校验并注册 MCP" })).toBeInTheDocument()
    cleanup()

    render(<LlmSettingsPage />)
    expect(screen.getByRole("heading", { name: "LLM 设置" })).toBeInTheDocument()
    expect(screen.getByLabelText("API Key · Default Orchestrator")).toBeInTheDocument()
    cleanup()

    render(<ApprovalPolicySettingsPage />)
    expect(screen.getByText("审批模式开关")).toBeInTheDocument()
    cleanup()

    render(<WorkLogsSettingsPage />)
    expect(screen.getByRole("heading", { name: "工作日志" })).toBeInTheDocument()
    cleanup()

    render(<AuditLogsSettingsPage />)
    expect(screen.getByRole("heading", { name: "审计日志" })).toBeInTheDocument()
    cleanup()

    render(<SystemStatusSettingsPage />)
    expect(screen.getByRole("heading", { name: "系统状态" })).toBeInTheDocument()
  })
})
