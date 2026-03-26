import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

import EditProjectPage from "@/app/(console)/projects/[projectId]/edit/page"
import ProjectsPage from "@/app/(console)/projects/page"
import NewProjectPage from "@/app/(console)/projects/new/page"

describe("Project pages", () => {
  it("shows the primary project list dataset", () => {
    render(<ProjectsPage />)

    expect(screen.getByText("华曜科技匿名外网面梳理")).toBeInTheDocument()
    expect(screen.getAllByText("新建项目").length).toBeGreaterThan(0)
    expect(screen.getByText("管理动作")).toBeInTheDocument()
  })

  it("renders the project creation form sections", () => {
    render(<NewProjectPage />)

    expect(screen.getByText("授权与范围")).toBeInTheDocument()
    expect(screen.getByText("执行与审批策略")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "创建项目" })).toBeInTheDocument()
  })

  it("renders the project edit form with save action", async () => {
    render(await EditProjectPage({ params: Promise.resolve({ projectId: "proj-huayao" }) }))

    expect(screen.getByText("编辑项目 · 华曜科技匿名外网面梳理")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "保存修改" })).toBeInTheDocument()
  })
})
