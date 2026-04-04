import { cleanup, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import ApprovalPolicySettingsPage from "@/app/(console)/settings/approval-policy/page"
import AuditLogsSettingsPage from "@/app/(console)/settings/audit-logs/page"
import VulnCenterPage from "@/app/(console)/vuln-center/page"
import LlmSettingsPage from "@/app/(console)/settings/llm/page"
import McpToolsSettingsPage from "@/app/(console)/settings/mcp-tools/page"
import SettingsPage from "@/app/(console)/settings/page"
import SystemStatusSettingsPage from "@/app/(console)/settings/system-status/page"
import WorkLogsSettingsPage from "@/app/(console)/settings/work-logs/page"

describe("Vuln center and settings pages", () => {
  it("renders the vuln center", async () => {
    render(<VulnCenterPage />)
    expect(screen.getByRole("heading", { name: "漏洞中心" })).toBeInTheDocument()
    cleanup()
  })

  it("renders the settings hub", async () => {
    render(await SettingsPage())
    expect(screen.getByRole("heading", { name: "设置分类" })).toBeInTheDocument()
    expect(screen.getAllByText("探测工具管理").length).toBeGreaterThan(0)
    expect(screen.getAllByText("LLM 设置").length).toBeGreaterThan(0)
    expect(screen.getAllByText("工作日志").length).toBeGreaterThan(0)
  })

  it("renders the split settings subpages", async () => {
    render(await McpToolsSettingsPage())
    expect(screen.getAllByText("探测工具管理").length).toBeGreaterThan(0)
    // "校验并注册 MCP" button is inside a collapsed Accordion section; assert the trigger instead
    expect(screen.getByText("MCP 契约注册")).toBeInTheDocument()
    cleanup()

    render(await LlmSettingsPage())
    expect(screen.getByRole("heading", { name: "LLM 设置" })).toBeInTheDocument()
    expect(screen.getByLabelText("API Key · Default Orchestrator")).toBeInTheDocument()
    cleanup()

    render(await ApprovalPolicySettingsPage())
    expect(screen.getByText("审批模式开关")).toBeInTheDocument()
    cleanup()

    render(await WorkLogsSettingsPage())
    expect(screen.getByRole("heading", { name: "工作日志" })).toBeInTheDocument()
    cleanup()

    render(await AuditLogsSettingsPage())
    expect(screen.getByRole("heading", { name: "审计日志" })).toBeInTheDocument()
    cleanup()

    render(await SystemStatusSettingsPage())
    expect(screen.getByRole("heading", { name: "系统状态" })).toBeInTheDocument()
  })
})
