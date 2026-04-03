import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SystemControlPanel } from "@/components/settings/system-control-panel"
import type { ApprovalControl, ControlSetting, PolicyRecord } from "@/lib/prototype-types"

const globalApprovalControl: ApprovalControl = {
  enabled: true,
  mode: "高风险需审批",
  autoApproveLowRisk: true,
  description: "全局审批策略",
  note: "",
}

const systemControlOverview: ControlSetting[] = [
  { label: "审批策略", value: "高风险需审批", description: "全局审批策略", tone: "info" },
]

const approvalPolicies: PolicyRecord[] = [
  { title: "高风险操作需审批", description: "对高风险 MCP 操作要求人工审批", owner: "admin", status: "active" },
]

const scopeRules: PolicyRecord[] = [
  { title: "仅限授权目标", description: "所有操作限定在授权范围内", owner: "admin", status: "active" },
]

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
