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
  it("shows the project overview with result entry links", async () => {
    const fixture = await createApprovedWorkflowFixture()

    render(await ProjectDetailPage({ params: Promise.resolve({ projectId: fixture.project.id }) }))

    // New summary shows state-aware content and result links
    expect(screen.getByText("最近动态")).toBeInTheDocument()
    // Results hub has link entries for the 4 result sections
    expect(screen.getAllByText("域名").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("站点").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("端口").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("漏洞").length).toBeGreaterThanOrEqual(1)
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
    expect(screen.getByText("影响面")).toBeInTheDocument()
    cleanup()

    render(await ProjectOperationsPage({ params: Promise.resolve({ projectId: fixture.project.id }) }))

    // Operations page now has compact panels
    expect(screen.getByText("审批与项目状态")).toBeInTheDocument()
    expect(screen.getByText("报告导出")).toBeInTheDocument()
    cleanup()

  })
})
