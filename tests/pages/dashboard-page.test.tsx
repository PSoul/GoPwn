import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import DashboardPage from "@/app/(console)/dashboard/page"

describe("DashboardPage", () => {
  it("shows key ops metrics and priority sections", () => {
    render(<DashboardPage />)

    expect(screen.getByText("待审批动作")).toBeInTheDocument()
    expect(screen.getByText("今天优先处理")).toBeInTheDocument()
    expect(screen.getByText("MCP 工具健康状态")).toBeInTheDocument()
  })
})
