import { describe, expect, it } from "vitest"

import { buildProjectClosureStatus } from "@/lib/project/project-closure-status"

describe("project closure status", () => {
  it("marks a fresh idle project as waiting for manual start", () => {
    const status = buildProjectClosureStatus({
      finalConclusionGenerated: false,
      lifecycle: "idle",
      pendingApprovals: 0,
      projectStatus: "待启动",
      queuedTaskCount: 0,
      reportExported: false,
      runningTaskCount: 0,
      waitingApprovalTaskCount: 0,
    })

    expect(status.state).toBe("waiting_start")
    expect(status.label).toBe("等待启动")
    expect(status.blockers).toEqual([
      expect.objectContaining({
        title: "等待研究员开始项目",
      }),
    ])
  })

  it("surfaces approval and runtime blockers before a project can settle", () => {
    const status = buildProjectClosureStatus({
      finalConclusionGenerated: false,
      lifecycle: "running",
      pendingApprovals: 2,
      projectStatus: "等待审批",
      queuedTaskCount: 1,
      reportExported: false,
      runningTaskCount: 1,
      waitingApprovalTaskCount: 1,
    })

    expect(status.state).toBe("blocked")
    expect(status.label).toBe("存在收尾阻塞")
    expect(status.blockers.map((item) => item.title)).toEqual(
      expect.arrayContaining(["待审批动作尚未清理", "仍有任务正在执行", "队列中仍有待运行任务"]),
    )
  })

  it("marks queue-drained projects as settling until report export and conclusion land", () => {
    const status = buildProjectClosureStatus({
      finalConclusionGenerated: false,
      lifecycle: "running",
      pendingApprovals: 0,
      projectStatus: "运行中",
      queuedTaskCount: 0,
      reportExported: false,
      runningTaskCount: 0,
      waitingApprovalTaskCount: 0,
    })

    expect(status.state).toBe("settling")
    expect(status.label).toBe("等待自动收尾")
    expect(status.blockers).toEqual([
      expect.objectContaining({
        title: "等待报告导出",
      }),
    ])
  })

  it("marks projects with a final conclusion as completed", () => {
    const status = buildProjectClosureStatus({
      finalConclusionGenerated: true,
      lifecycle: "running",
      pendingApprovals: 0,
      projectStatus: "已完成",
      queuedTaskCount: 0,
      reportExported: true,
      runningTaskCount: 0,
      waitingApprovalTaskCount: 0,
    })

    expect(status.state).toBe("completed")
    expect(status.label).toBe("已完成当前轮次")
    expect(status.blockers).toHaveLength(0)
    expect(status.finalConclusionGenerated).toBe(true)
    expect(status.reportExported).toBe(true)
  })
})
