import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ProjectMcpRunsPanel } from "@/components/projects/project-mcp-runs-panel"
import type { McpRunRecord } from "@/lib/prototype-types"

const initialRuns: McpRunRecord[] = [
  {
    id: "run-history-1",
    projectId: "proj-readonly",
    projectName: "只读项目",
    capability: "Web 页面探测类",
    toolId: "tool-web-surface",
    toolName: "web-surface-map",
    requestedAction: "补采页面入口与响应特征",
    target: "http://127.0.0.1:3000",
    riskLevel: "低",
    boundary: "外部目标交互",
    dispatchMode: "自动执行",
    status: "已执行",
    requestedBy: "LLM 编排内核",
    createdAt: "2026-03-28 15:10",
    updatedAt: "2026-03-28 15:10",
    summaryLines: ["历史运行记录。"],
  },
]

describe("ProjectMcpRunsPanel", () => {
  it("switches into read-only mode for completed projects while preserving history", () => {
    render(
      <ProjectMcpRunsPanel
        projectId="proj-readonly"
        defaultTarget="http://127.0.0.1:3000"
        capabilities={["Web 页面探测类", "报告导出类"]}
        initialRuns={initialRuns}
        readOnlyReason="当前项目已完成当前轮次，手动 MCP 调度已切换为只读。"
      />,
    )

    expect(screen.getByText("当前项目已完成当前轮次，手动 MCP 调度已切换为只读。")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "运行基础流程" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "运行含审批流程" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "发起 MCP 调度" })).toBeDisabled()
    expect(screen.getByText("历史运行记录。")).toBeInTheDocument()
  })
})
