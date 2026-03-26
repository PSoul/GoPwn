import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import DashboardPage from "@/app/(console)/dashboard/page"

describe("DashboardPage", () => {
  it("shows key ops metrics and priority sections", () => {
    render(<DashboardPage />)

    expect(screen.getByText("当前阻塞动作")).toBeInTheDocument()
    expect(screen.getByText("最近处置记录")).toBeInTheDocument()
    expect(screen.getByText("今天优先处理")).toBeInTheDocument()
  })
})
