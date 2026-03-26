import { cleanup, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import ProjectContextPage from "@/app/(console)/projects/[projectId]/context/page"
import ProjectFlowPage from "@/app/(console)/projects/[projectId]/flow/page"
import ProjectOperationsPage from "@/app/(console)/projects/[projectId]/operations/page"
import ProjectDetailPage from "@/app/(console)/projects/[projectId]/page"
import ProjectFindingsResultsPage from "@/app/(console)/projects/[projectId]/results/findings/page"
import ProjectDomainsResultsPage from "@/app/(console)/projects/[projectId]/results/domains/page"
import ProjectNetworkResultsPage from "@/app/(console)/projects/[projectId]/results/network/page"

describe("ProjectDetailPage", () => {
  it("shows the project overview with links to dedicated result tables", async () => {
    render(await ProjectDetailPage({ params: Promise.resolve({ projectId: "proj-huayao" }) }))

    expect(screen.getByText("华曜科技匿名外网面梳理")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "查看域名 / Web 入口表格" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "查看 IP / 端口 / 服务表格" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "查看漏洞与发现表格" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "查看阶段流转详情" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "查看任务与调度详情" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "查看证据与上下文" })).toBeInTheDocument()
  })

  it("renders dedicated result pages plus flow, operations, and context", async () => {
    render(await ProjectDomainsResultsPage({ params: Promise.resolve({ projectId: "proj-huayao" }) }))

    expect(screen.getByRole("heading", { level: 1, name: "域名 / Web 入口" })).toBeInTheDocument()
    expect(screen.getByText("对象 / 入口")).toBeInTheDocument()
    cleanup()

    render(await ProjectNetworkResultsPage({ params: Promise.resolve({ projectId: "proj-huayao" }) }))

    expect(screen.getByRole("heading", { level: 1, name: "IP / 端口 / 服务" })).toBeInTheDocument()
    expect(screen.getByText("当前画像 / 说明")).toBeInTheDocument()
    cleanup()

    render(await ProjectFindingsResultsPage({ params: Promise.resolve({ projectId: "proj-huayao" }) }))

    expect(screen.getByRole("heading", { level: 1, name: "漏洞与发现" })).toBeInTheDocument()
    expect(screen.getByText("影响面")).toBeInTheDocument()
    cleanup()

    render(await ProjectFlowPage({ params: Promise.resolve({ projectId: "proj-huayao" }) }))

    expect(screen.getByText("阶段流转详情")).toBeInTheDocument()
    expect(screen.getByText("回流提示")).toBeInTheDocument()
    cleanup()

    render(await ProjectOperationsPage({ params: Promise.resolve({ projectId: "proj-huayao" }) }))

    expect(screen.getByText("任务与调度详情")).toBeInTheDocument()
    expect(screen.getByText("审批模式开关")).toBeInTheDocument()
    cleanup()

    render(await ProjectContextPage({ params: Promise.resolve({ projectId: "proj-huayao" }) }))

    expect(screen.getByText("证据与上下文")).toBeInTheDocument()
    expect(screen.getByText("项目证据与上下文")).toBeInTheDocument()
  })
})
