import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ApprovalCenterClient } from "@/components/approvals/approval-center-client"
import { approvals } from "@/lib/prototype-data"

describe("ApprovalCenterClient", () => {
  beforeEach(() => {
    global.fetch = vi.fn() as unknown as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("submits approval decisions and updates success state", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        approval: {
          ...approvals[0],
          status: "已批准",
        },
      }),
    } as Response)

    render(<ApprovalCenterClient initialApprovals={approvals} />)

    fireEvent.click(screen.getByRole("button", { name: "批准并进入调度" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/approvals/${approvals[0].id}`,
        expect.objectContaining({
          method: "PATCH",
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText(`审批单 ${approvals[0].id} 已更新为“已批准”。`)).toBeInTheDocument()
    })
  })
})
