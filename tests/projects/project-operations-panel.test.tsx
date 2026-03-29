import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ProjectOperationsPanel } from "@/components/projects/project-operations-panel"
import { getProjectApprovals, getProjectById, getProjectDetailById } from "@/lib/prototype-data"

describe("ProjectOperationsPanel", () => {
  beforeEach(() => {
    global.fetch = vi.fn() as unknown as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("persists project approval-control updates", async () => {
    const project = getProjectById("proj-huayao")
    const detail = getProjectDetailById("proj-huayao")

    if (!project || !detail) {
      throw new Error("fixture project not found")
    }

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        project: {
          ...project,
          approvalMode: "中高风险动作审批",
        },
        detail: {
          ...detail,
          approvalControl: {
            ...detail.approvalControl,
            autoApproveLowRisk: false,
            mode: "中高风险动作审批",
            note: "项目测试备注",
          },
        },
      }),
    } as Response)

    render(<ProjectOperationsPanel project={project} detail={detail} approvals={getProjectApprovals("proj-huayao")} />)

    // New compact panel has simpler switches
    fireEvent.click(screen.getByRole("switch", { name: "低风险自动放行" }))
    fireEvent.click(screen.getByRole("button", { name: /保存/ }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/projects/${project.id}/approval-control`,
        expect.objectContaining({ method: "PATCH" }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText("审批策略已更新")).toBeInTheDocument()
    })
  })
})
