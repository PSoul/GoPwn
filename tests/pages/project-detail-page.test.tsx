import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import ProjectDetailPage from "@/app/(console)/projects/[projectId]/page"

describe("ProjectDetailPage", () => {
  it("shows the project flow hub sections", () => {
    render(<ProjectDetailPage />)

    expect(screen.getByText("当前主阶段")).toBeInTheDocument()
    expect(screen.getByText("回流提示")).toBeInTheDocument()
    expect(screen.getByText("任务与调度")).toBeInTheDocument()
  })
})
