import { cleanup, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/assets",
  useRouter: () => ({
    replace: vi.fn(),
  }),
}))

import AssetsPage from "@/app/(console)/assets/page"
import AssetDetailPage from "@/app/(console)/assets/[assetId]/page"
import { createWorkflowFixture } from "@/tests/helpers/project-fixtures"

describe("Assets pages", () => {
  it("renders asset list and asset detail profile", async () => {
    const fixture = await createWorkflowFixture({ workflow: "with-approval" })
    render(await AssetsPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByText("资产中心")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "域名 / Web" })).toBeInTheDocument()
    cleanup()

    render(await AssetDetailPage({ params: Promise.resolve({ assetId: fixture.assets[0].id }) }))
    expect(screen.getByText("当前识别画像")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: `资产详情 · ${fixture.assets[0].host}` })).toBeInTheDocument()
  })
})
