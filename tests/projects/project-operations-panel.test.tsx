import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ProjectOperationsPanel } from "@/components/projects/project-operations-panel"
import type { ApprovalRecord, ProjectDetailRecord, ProjectRecord } from "@/lib/prototype-types"

const project: ProjectRecord = {
  id: "proj-test-ops",
  code: "TEST-OPS",
  name: "测试项目",
  targetInput: "example.com",
  targets: ["example.com"],
  description: "测试用",
  stage: "授权与范围定义",
  status: "运行中",
  pendingApprovals: 0,
  openTasks: 0,
  assetCount: 0,
  evidenceCount: 0,
  riskSummary: "",
  summary: "",
  lastActor: "admin",
  createdAt: "2026-04-01 10:00",
  lastUpdated: "2026-04-01 10:00",
}

const detail: ProjectDetailRecord = {
  projectId: project.id,
  target: "example.com",
  blockingReason: "",
  nextStep: "",
  reflowNotice: "",
  currentFocus: "",
  timeline: [{ title: "授权与范围定义", state: "done", note: "授权阶段" }],
  tasks: [],
  discoveredInfo: [],
  serviceSurface: [],
  fingerprints: [],
  entries: [],
  scheduler: [],
  activity: [],
  resultMetrics: [],
  assetGroups: [],
  findings: [],
  currentStage: { title: "授权与范围定义", summary: "", blocker: "", owner: "admin", updatedAt: "2026-04-01 10:00" },
  approvalControl: { enabled: true, mode: "高风险需审批", autoApproveLowRisk: true, autoApproveMediumRisk: true, description: "", note: "" },
  closureStatus: { state: "running", label: "运行中", tone: "info", summary: "", blockers: [], reportExported: false, finalConclusionGenerated: false },
  finalConclusion: null,
}

const approvals: ApprovalRecord[] = []

describe("ProjectOperationsPanel", () => {
  beforeEach(() => {
    global.fetch = vi.fn() as unknown as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("persists project approval-control updates", async () => {

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

    render(<ProjectOperationsPanel project={project} detail={detail} approvals={approvals} />)

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
