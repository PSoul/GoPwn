import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ApprovalCenterClient } from "@/components/approvals/approval-center-client"
import type { ApprovalRecord } from "@/lib/prototype-types"

const approvals: ApprovalRecord[] = [
  {
    id: "appr-test-001",
    projectId: "proj-test",
    projectName: "测试项目",
    target: "example.com",
    actionType: "端口扫描",
    riskLevel: "高",
    rationale: "需要确认开放端口",
    impact: "可能触发 IDS",
    mcpCapability: "端口扫描类",
    tool: "fscan",
    status: "待处理",
    parameterSummary: "-h example.com -p 1-65535",
    prerequisites: [],
    stopCondition: "扫描完成",
    blockingImpact: "阻塞后续漏洞扫描",
    queuePosition: 1,
    submittedAt: "2026-04-01 10:00",
  },
]

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

    // AlertDialog confirmation step — approve/reject now require explicit confirmation
    fireEvent.click(screen.getByRole("button", { name: "确认批准" }))

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
