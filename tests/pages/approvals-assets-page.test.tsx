import { cleanup, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import ApprovalsPage from "@/app/(console)/approvals/page"
import AssetsPage from "@/app/(console)/assets/page"
import AssetDetailPage from "@/app/(console)/assets/[assetId]/page"

describe("Approvals and assets pages", () => {
  it("renders the approvals center", () => {
    render(<ApprovalsPage />)

    expect(screen.getByText("审批中心")).toBeInTheDocument()
    expect(screen.getByText("待处理审批")).toBeInTheDocument()
  })

  it("renders asset list and asset detail profile", async () => {
    render(<AssetsPage />)
    expect(screen.getByText("资产中心")).toBeInTheDocument()
    cleanup()

    render(await AssetDetailPage({ params: Promise.resolve({ assetId: "asset-api" }) }))
    expect(screen.getByText("当前识别画像")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "资产详情 · api.yunlanmed.com" })).toBeInTheDocument()
  })
})
