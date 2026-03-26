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

    fireEvent.click(screen.getByRole("switch", { name: "项目低风险自动放行" }))
    fireEvent.change(screen.getByRole("textbox", { name: "项目策略备注" }), {
      target: { value: "项目测试备注" },
    })
    fireEvent.click(screen.getByRole("button", { name: "保存项目策略" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/projects/${project.id}/approval-control`,
        expect.objectContaining({
          method: "PATCH",
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText("项目审批策略已更新：中高风险动作审批")).toBeInTheDocument()
    })
  })
})
