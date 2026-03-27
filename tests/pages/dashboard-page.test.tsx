import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import DashboardPage from "@/app/(console)/dashboard/page"
import { createWorkflowFixture } from "@/tests/helpers/project-fixtures"

describe("DashboardPage", () => {
  it("shows the empty state when no real project data exists", () => {
    render(<DashboardPage />)

    expect(screen.getByText("当前还没有真实项目数据")).toBeInTheDocument()
    expect(screen.getByText("新建第一个项目")).toBeInTheDocument()
  })

  it("shows the populated operations surface after a real workflow run", async () => {
    const fixture = await createWorkflowFixture({ workflow: "with-approval" })

    render(<DashboardPage />)

    expect(screen.getByText("当前阻塞动作")).toBeInTheDocument()
    expect(screen.getByText("最近处置记录")).toBeInTheDocument()
    expect(screen.getByText("当前优先处理")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: fixture.project.name })).toBeInTheDocument()
  })
})
