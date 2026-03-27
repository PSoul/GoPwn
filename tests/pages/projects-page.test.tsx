import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

import EditProjectPage from "@/app/(console)/projects/[projectId]/edit/page"
import ProjectsPage from "@/app/(console)/projects/page"
import NewProjectPage from "@/app/(console)/projects/new/page"
import { createStoredProjectFixture } from "@/tests/helpers/project-fixtures"

describe("Project pages", () => {
  it("shows the primary project list dataset", () => {
    const fixture = createStoredProjectFixture()
    render(<ProjectsPage />)

    expect(screen.getByText(fixture.project.name)).toBeInTheDocument()
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
    const fixture = createStoredProjectFixture()

    render(await EditProjectPage({ params: Promise.resolve({ projectId: fixture.project.id }) }))

    expect(screen.getByText(`编辑项目 · ${fixture.project.name}`)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "保存修改" })).toBeInTheDocument()
  })
})
