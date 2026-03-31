import { cleanup, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import ProjectContextPage from "@/app/(console)/projects/[projectId]/context/page"
import ProjectFlowPage from "@/app/(console)/projects/[projectId]/flow/page"
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
    // Results hub has link entries for the 3 result sections
    expect(screen.getByText("域名 / Web")).toBeInTheDocument()
    expect(screen.getByText("IP / 端口 / 服务")).toBeInTheDocument()
    expect(screen.getByText("漏洞与发现")).toBeInTheDocument()
  })

  it("renders dedicated result pages plus flow, operations, and context", async () => {
    const fixture = await createApprovedWorkflowFixture()

    render(await ProjectDomainsResultsPage({ params: Promise.resolve({ projectId: fixture.project.id }) }))

    expect(screen.getByRole("heading", { level: 2, name: "域名 / Web 入口" })).toBeInTheDocument()
    expect(screen.getByText("对象 / 入口")).toBeInTheDocument()
    cleanup()

    render(await ProjectNetworkResultsPage({ params: Promise.resolve({ projectId: fixture.project.id }) }))

    expect(screen.getByRole("heading", { level: 2, name: "IP / 端口 / 服务" })).toBeInTheDocument()
    // Network results may show the Empty component when no items exist
    expect(screen.getByText("暂无 IP / 端口 / 服务")).toBeInTheDocument()
    cleanup()

    render(await ProjectFindingsResultsPage({ params: Promise.resolve({ projectId: fixture.project.id }) }))

    expect(screen.getByRole("heading", { level: 2, name: "漏洞与发现" })).toBeInTheDocument()
    expect(screen.getByText("影响面")).toBeInTheDocument()
    cleanup()

    render(await ProjectFlowPage({ params: Promise.resolve({ projectId: fixture.project.id }) }))

    expect(screen.getByText("阶段流转详情")).toBeInTheDocument()
    expect(screen.getByText("阶段提示")).toBeInTheDocument()
    cleanup()

    render(await ProjectOperationsPage({ params: Promise.resolve({ projectId: fixture.project.id }) }))

    // Operations page now has compact panels
    expect(screen.getByText("审批与项目状态")).toBeInTheDocument()
    expect(screen.getByText("报告导出")).toBeInTheDocument()
    cleanup()

    render(await ProjectContextPage({ params: Promise.resolve({ projectId: fixture.project.id }) }))

    expect(screen.getByText("证据与上下文")).toBeInTheDocument()
    expect(screen.getByText("项目证据与上下文")).toBeInTheDocument()
  })
})
