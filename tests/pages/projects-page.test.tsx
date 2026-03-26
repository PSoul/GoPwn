import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import ProjectsPage from "@/app/(console)/projects/page"
import NewProjectPage from "@/app/(console)/projects/new/page"

describe("Project pages", () => {
  it("shows the primary project list dataset", () => {
    render(<ProjectsPage />)

    expect(screen.getByText("华曜科技匿名外网面梳理")).toBeInTheDocument()
    expect(screen.getByText("新建项目")).toBeInTheDocument()
  })

  it("renders the project creation form sections", () => {
    render(<NewProjectPage />)

    expect(screen.getByText("授权与范围")).toBeInTheDocument()
    expect(screen.getByText("审批策略")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "创建项目" })).toBeInTheDocument()
  })
})
