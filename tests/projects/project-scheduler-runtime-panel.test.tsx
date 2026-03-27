import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ProjectSchedulerRuntimePanel } from "@/components/projects/project-scheduler-runtime-panel"
import type { McpSchedulerTaskRecord, ProjectSchedulerControl } from "@/lib/prototype-types"

const refresh = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}))

const initialControl: ProjectSchedulerControl = {
  paused: false,
  note: "默认允许调度器继续处理待执行任务。",
  updatedAt: "2026-03-27 15:00",
}

const schedulerTasks: McpSchedulerTaskRecord[] = [
  {
    id: "task-ready",
    runId: "run-ready",
    projectId: "proj-runtime",
    projectName: "运行控制测试项目",
    capability: "DNS / 子域 / 证书情报类",
    target: "api.example.test",
    toolName: "dns-census",
    connectorMode: "real",
    status: "ready",
    attempts: 0,
    maxAttempts: 1,
    queuedAt: "2026-03-27 15:00",
    availableAt: "2026-03-27 15:00",
    updatedAt: "2026-03-27 15:00",
    summaryLines: ["等待调度器认领。"],
  },
  {
    id: "task-failed",
    runId: "run-failed",
    projectId: "proj-runtime",
    projectName: "运行控制测试项目",
    capability: "Web 页面探测类",
    target: "https://portal.example.test/login",
    toolName: "web-surface-map",
    connectorMode: "real",
    status: "failed",
    attempts: 1,
    maxAttempts: 2,
    queuedAt: "2026-03-27 15:01",
    availableAt: "2026-03-27 15:01",
    updatedAt: "2026-03-27 15:02",
    lastError: "temporary timeout",
    summaryLines: ["最近一次执行失败。"],
  },
  {
    id: "task-running",
    runId: "run-running",
    projectId: "proj-runtime",
    projectName: "运行控制测试项目",
    capability: "截图与证据采集类",
    target: "https://portal.example.test/dashboard",
    toolName: "shot-capture",
    connectorMode: "real",
    status: "running",
    attempts: 1,
    maxAttempts: 1,
    queuedAt: "2026-03-27 15:03",
    availableAt: "2026-03-27 15:03",
    updatedAt: "2026-03-27 15:03",
    summaryLines: ["正在执行截图采集。"],
  },
]

describe("ProjectSchedulerRuntimePanel", () => {
  beforeEach(() => {
    refresh.mockReset()
    global.fetch = vi.fn() as unknown as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("persists project scheduler control updates and refreshes the route", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        schedulerControl: {
          paused: true,
          note: "暂停夜间窗口外的自动调度。",
          updatedAt: "2026-03-27 15:08",
        },
      }),
    } as Response)

    render(
      <ProjectSchedulerRuntimePanel
        projectId="proj-runtime"
        initialControl={initialControl}
        initialTasks={schedulerTasks}
      />,
    )

    fireEvent.click(screen.getByRole("switch", { name: "项目调度开关" }))
    fireEvent.change(screen.getByRole("textbox", { name: "调度控制备注" }), {
      target: { value: "暂停夜间窗口外的自动调度。" },
    })
    fireEvent.click(screen.getByRole("button", { name: "保存调度控制" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/projects/proj-runtime/scheduler-control",
        expect.objectContaining({
          method: "PATCH",
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText("项目调度已暂停")).toBeInTheDocument()
      expect(refresh).toHaveBeenCalled()
    })
  })

  it("cancels a queued scheduler task through the project api", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        task: {
          ...schedulerTasks[0],
          status: "cancelled",
          updatedAt: "2026-03-27 15:10",
          summaryLines: [...schedulerTasks[0].summaryLines, "研究员手动取消当前排队任务。"],
        },
        run: {
          id: "run-ready",
          status: "已取消",
        },
      }),
    } as Response)

    render(
      <ProjectSchedulerRuntimePanel
        projectId="proj-runtime"
        initialControl={initialControl}
        initialTasks={schedulerTasks}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "取消任务 api.example.test" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/projects/proj-runtime/scheduler-tasks/task-ready",
        expect.objectContaining({
          method: "PATCH",
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/api.example.test 已从运行队列移除/)).toBeInTheDocument()
      expect(refresh).toHaveBeenCalled()
    })
  })

  it("shows disabled states for unsupported actions while allowing failed tasks to retry", () => {
    render(
      <ProjectSchedulerRuntimePanel
        projectId="proj-runtime"
        initialControl={initialControl}
        initialTasks={schedulerTasks}
      />,
    )

    expect(screen.getByRole("button", { name: "取消任务 https://portal.example.test/dashboard" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "重试任务 api.example.test" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "重试任务 https://portal.example.test/login" })).toBeEnabled()
  })
})
