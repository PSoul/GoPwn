import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SystemControlPanel } from "@/components/settings/system-control-panel"
import {
  approvalPolicies,
  globalApprovalControl,
  scopeRules,
  systemControlOverview,
} from "@/lib/prototype-data"

describe("SystemControlPanel", () => {
  beforeEach(() => {
    global.fetch = vi.fn() as unknown as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("persists global approval-control updates", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        approvalControl: {
          ...globalApprovalControl,
          autoApproveLowRisk: false,
          mode: "中高风险动作审批",
          note: "测试备注",
        },
      }),
    } as Response)

    render(
      <SystemControlPanel
        overview={systemControlOverview}
        approvalControl={globalApprovalControl}
        approvalPolicies={approvalPolicies}
        scopeRules={scopeRules}
      />,
    )

    fireEvent.click(screen.getByRole("switch", { name: "低风险自动放行" }))
    fireEvent.change(screen.getByRole("textbox", { name: "全局策略备注" }), {
      target: { value: "测试备注" },
    })
    fireEvent.click(screen.getByRole("button", { name: "保存全局策略" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/settings/approval-policy",
        expect.objectContaining({
          method: "PATCH",
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText("全局审批策略已更新：中高风险动作审批")).toBeInTheDocument()
    })
  })
})
