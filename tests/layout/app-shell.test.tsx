import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AppShell } from "@/components/layout/app-shell"
import { prototypeNavigation } from "@/lib/infra/navigation"

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}))

describe("prototype navigation", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          metrics: [
            { label: "项目总数", value: "1" },
            { label: "待审批动作", value: "2" },
          ],
        }),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("defines the primary console destinations", () => {
    expect(prototypeNavigation.map((item) => item.href)).toEqual([
      "/dashboard",
      "/projects",
      "/assets",
      "/vuln-center",
      "/settings",
    ])
  })

  it("renders shared navigation and a main landmark", () => {
    render(<AppShell title="仪表盘">content</AppShell>)

    expect(screen.getByText("项目管理")).toBeInTheDocument()
    expect(screen.getByRole("main")).toBeInTheDocument()
  })

  it("refreshes sidebar badges from real dashboard metrics", async () => {
    render(<AppShell title="仪表盘">content</AppShell>)

    expect((await screen.findAllByText("1")).length).toBeGreaterThan(0)
  })
})
