import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import EvidencePage from "@/app/(console)/evidence/page"
import EvidenceDetailPage from "@/app/(console)/evidence/[evidenceId]/page"
import SettingsPage from "@/app/(console)/settings/page"

describe("Evidence and settings pages", () => {
  it("renders the evidence list and detail flow", () => {
    render(<EvidencePage />)
    expect(screen.getByText("证据与结果")).toBeInTheDocument()

    render(<EvidenceDetailPage />)
    expect(screen.getByText("原始输出")).toBeInTheDocument()
  })

  it("renders the settings control console", () => {
    render(<SettingsPage />)
    expect(screen.getByText("MCP 工具管理")).toBeInTheDocument()
  })
})
