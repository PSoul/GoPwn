import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import DashboardPage from "@/app/(console)/dashboard/page"
import { createWorkflowFixture } from "@/tests/helpers/project-fixtures"

describe("DashboardPage", () => {
  it("shows the empty state when no real project data exists", () => {
    render(<DashboardPage />)

    expect(screen.getByText("平台仪表盘")).toBeInTheDocument()
    expect(screen.getByText("最近结果更新")).toBeInTheDocument()
    expect(screen.getByText("全局资产预览")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "新建项目" })).toBeInTheDocument()
  })

  it("shows the populated operations surface after a real workflow run", async () => {
    const fixture = await createWorkflowFixture({ workflow: "with-approval" })

    render(<DashboardPage />)

    expect(screen.getByText("平台仪表盘")).toBeInTheDocument()
    expect(screen.getByText("最近结果更新")).toBeInTheDocument()
    expect(screen.getByText("全局资产预览")).toBeInTheDocument()
    expect(screen.getAllByText(fixture.project.name).length).toBeGreaterThan(0)
  })
})
