import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AppShell } from "@/components/layout/app-shell"
import { prototypeNavigation } from "@/lib/navigation"

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}))

describe("prototype navigation", () => {
  it("defines the six primary console destinations", () => {
    expect(prototypeNavigation.map((item) => item.href)).toEqual([
      "/dashboard",
      "/projects",
      "/approvals",
      "/assets",
      "/evidence",
      "/settings",
    ])
  })

  it("renders shared navigation and a main landmark", () => {
    render(<AppShell title="仪表盘">content</AppShell>)

    expect(screen.getByText("项目管理")).toBeInTheDocument()
    expect(screen.getByRole("main")).toBeInTheDocument()
  })
})
