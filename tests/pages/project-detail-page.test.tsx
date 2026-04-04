import { cleanup, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import ProjectOperationsPage from "@/app/(console)/projects/[projectId]/operations/page"
import ProjectDetailPage from "@/app/(console)/projects/[projectId]/page"
import ProjectFindingsResultsPage from "@/app/(console)/projects/[projectId]/results/findings/page"
import ProjectDomainsResultsPage from "@/app/(console)/projects/[projectId]/results/domains/page"
import ProjectNetworkResultsPage from "@/app/(console)/projects/[projectId]/results/network/page"
import { createApprovedWorkflowFixture } from "@/tests/helpers/project-fixtures"

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation")

  return {
    ...actual,
    useRouter: () => ({
      refresh: vi.fn(),
    }),
    usePathname: () => "/projects/proj-test",
  }
})

describe("ProjectDetailPage", () => {
  it("shows the project live dashboard with stats and tabs", async () => {
    const fixture = await createApprovedWorkflowFixture()

    render(await ProjectDetailPage({ params: Promise.resolve({ projectId: fixture.project.id }) }))

    // Live dashboard shows project name and tabs
    expect(screen.getByText(fixture.project.name)).toBeInTheDocument()
    expect(screen.getByText("漏洞")).toBeInTheDocument()
    expect(screen.getByText("资产")).toBeInTheDocument()
    expect(screen.getByText("执行日志")).toBeInTheDocument()
  })

  it("renders dedicated result pages plus operations", async () => {
    const fixture = await createApprovedWorkflowFixture()

    render(await ProjectDomainsResultsPage({ params: Promise.resolve({ projectId: fixture.project.id }) }))

    expect(screen.getByRole("heading", { level: 2, name: "域名列表" })).toBeInTheDocument()
    expect(screen.getByText("解析 IP")).toBeInTheDocument()
    cleanup()

    render(await ProjectNetworkResultsPage({ params: Promise.resolve({ projectId: fixture.project.id }) }))

    expect(screen.getByRole("heading", { level: 2, name: "扫描结果" })).toBeInTheDocument()
    // May show empty or table depending on fixture data
    expect(screen.getByText("端口")).toBeInTheDocument()
    cleanup()

    render(await ProjectFindingsResultsPage({ params: Promise.resolve({ projectId: fixture.project.id }) }))

    expect(screen.getByRole("heading", { level: 2, name: "漏洞与发现" })).toBeInTheDocument()
    // Fixture has no seeded findings — page shows empty state or table depending on data
    expect(screen.getByText("暂无漏洞与发现")).toBeInTheDocument()
    cleanup()

    render(await ProjectOperationsPage({ params: Promise.resolve({ projectId: fixture.project.id }) }))

    // Operations page now has compact panels
    expect(screen.getByText("审批与项目状态")).toBeInTheDocument()
    expect(screen.getByText("报告导出")).toBeInTheDocument()
    cleanup()

  })
})
