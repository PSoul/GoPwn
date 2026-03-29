import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ProjectSchedulerRuntimePanel } from "@/components/projects/project-scheduler-runtime-panel"
import type {
  McpSchedulerTaskRecord,
  ProjectClosureStatusRecord,
  ProjectSchedulerControl,
  ProjectStatus,
} from "@/lib/prototype-types"

const refresh = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}))

const initialControl: ProjectSchedulerControl = {
  lifecycle: "running",
  paused: false,
  note: "默认允许调度器继续处理待执行任务。",
  updatedAt: "2026-03-27 15:00",
}

const runningClosureStatus: ProjectClosureStatusRecord = {
  state: "running",
  label: "运行中",
  tone: "info",
  summary: "当前项目仍在执行中，LLM 与调度器会继续推进 MCP 动作。",
  blockers: [],
  reportExported: false,
  finalConclusionGenerated: false,
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
    heartbeatAt: "2026-03-27 15:04",
    leaseExpiresAt: "2026-03-27 15:05",
    leaseStartedAt: "2026-03-27 15:03",
    leaseToken: "lease-running",
    workerId: "worker-running",
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

  it("starts an idle project through the lifecycle controls and refreshes the route", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        project: {
          id: "proj-runtime",
          status: "运行中",
        },
        schedulerControl: {
          lifecycle: "running",
          paused: false,
          note: "研究员确认开始项目。",
          updatedAt: "2026-03-27 15:08",
        },
      }),
    } as Response)

    render(
      <ProjectSchedulerRuntimePanel
        projectId="proj-runtime"
        projectStatus={"待处理" satisfies ProjectStatus}
        closureStatus={runningClosureStatus}
        initialControl={{ ...initialControl, lifecycle: "idle", paused: false }}
        initialTasks={schedulerTasks}
      />,
    )

    fireEvent.change(screen.getByRole("textbox", { name: "调度控制备注" }), {
      target: { value: "研究员确认开始项目。" },
    })
    fireEvent.click(screen.getByRole("button", { name: "开始项目" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/projects/proj-runtime/scheduler-control",
        expect.objectContaining({
          method: "PATCH",
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText("项目已开始，目标已交给 LLM 进入调度。")).toBeInTheDocument()
      expect(refresh).toHaveBeenCalled()
    })
  })

  it("pauses and resumes a running project through the lifecycle controls", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          project: {
            id: "proj-runtime",
            status: "已暂停",
          },
          schedulerControl: {
            lifecycle: "paused",
            paused: true,
            note: "暂停夜间窗口外的自动调度。",
            updatedAt: "2026-03-27 15:08",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          project: {
            id: "proj-runtime",
            status: "运行中",
          },
          schedulerControl: {
            lifecycle: "running",
            paused: true,
            note: "暂停夜间窗口外的自动调度。",
            updatedAt: "2026-03-27 15:08",
          },
        }),
      } as Response)

    render(
      <ProjectSchedulerRuntimePanel
        projectId="proj-runtime"
        projectStatus={"运行中" satisfies ProjectStatus}
        closureStatus={runningClosureStatus}
        initialControl={initialControl}
        initialTasks={schedulerTasks}
      />,
    )

    fireEvent.change(screen.getByRole("textbox", { name: "调度控制备注" }), {
      target: { value: "暂停夜间窗口外的自动调度。" },
    })
    fireEvent.click(screen.getByRole("button", { name: "暂停项目" }))

    await waitFor(() => {
      expect(screen.getByText("项目已暂停，新的调度与 LLM 编排已挂起。")).toBeInTheDocument()
    })

    fireEvent.change(screen.getByRole("textbox", { name: "调度控制备注" }), {
      target: { value: "研究员恢复项目执行。" },
    })
    fireEvent.click(screen.getByRole("button", { name: "继续项目" }))

    await waitFor(() => {
      expect(screen.getByText("项目已恢复，调度与 LLM 编排继续执行。")).toBeInTheDocument()
      expect(refresh).toHaveBeenCalled()
    })
  })

  it("stops a project permanently and disables restarting from the panel", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        project: {
          id: "proj-runtime",
          status: "已停止",
        },
        schedulerControl: {
          lifecycle: "stopped",
          paused: true,
          note: "研究员确认停止项目。",
          updatedAt: "2026-03-27 15:09",
        },
      }),
    } as Response)

    render(
      <ProjectSchedulerRuntimePanel
        projectId="proj-runtime"
        projectStatus={"运行中" satisfies ProjectStatus}
        closureStatus={runningClosureStatus}
        initialControl={initialControl}
        initialTasks={schedulerTasks}
      />,
    )

    fireEvent.change(screen.getByRole("textbox", { name: "调度控制备注" }), {
      target: { value: "研究员确认停止项目。" },
    })
    fireEvent.click(screen.getByRole("button", { name: "停止项目" }))

    await waitFor(() => {
      expect(screen.getByText("项目已停止，后续不会再重新开始。")).toBeInTheDocument()
    })

    expect(screen.getByRole("button", { name: "开始项目" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "继续项目" })).toBeDisabled()
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
        projectStatus={"运行中" satisfies ProjectStatus}
        closureStatus={runningClosureStatus}
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

  it("records a stop request for a running scheduler task", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        task: {
          ...schedulerTasks[2],
          status: "cancelled",
          updatedAt: "2026-03-27 15:11",
          summaryLines: [...schedulerTasks[2].summaryLines, "研究员请求停止当前运行中的任务。"],
        },
        run: {
          id: "run-running",
          status: "已取消",
        },
      }),
    } as Response)

    render(
      <ProjectSchedulerRuntimePanel
        projectId="proj-runtime"
        projectStatus={"运行中" satisfies ProjectStatus}
        closureStatus={runningClosureStatus}
        initialControl={initialControl}
        initialTasks={schedulerTasks}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "请求停止任务 https://portal.example.test/dashboard" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/projects/proj-runtime/scheduler-tasks/task-running",
        expect.objectContaining({
          method: "PATCH",
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/https:\/\/portal\.example\.test\/dashboard 已记录停止请求/)).toBeInTheDocument()
      expect(refresh).toHaveBeenCalled()
    })
  })

  it("shows disabled states for unsupported actions while allowing failed tasks to retry", () => {
    render(
      <ProjectSchedulerRuntimePanel
        projectId="proj-runtime"
        projectStatus={"运行中" satisfies ProjectStatus}
        closureStatus={runningClosureStatus}
        initialControl={initialControl}
        initialTasks={schedulerTasks}
      />,
    )

    expect(screen.getByRole("button", { name: "请求停止任务 https://portal.example.test/dashboard" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "重试任务 api.example.test" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "重试任务 https://portal.example.test/login" })).toBeEnabled()
  })

  it("renders durable worker lease metadata for running tasks", () => {
    render(
      <ProjectSchedulerRuntimePanel
        projectId="proj-runtime"
        projectStatus={"运行中" satisfies ProjectStatus}
        closureStatus={runningClosureStatus}
        initialControl={initialControl}
        initialTasks={[
          {
            ...schedulerTasks[2],
            lastRecoveredAt: "2026-03-27 15:02",
            recoveryCount: 1,
          },
        ]}
      />,
    )

    expect(screen.getByText(/执行 worker worker-running/)).toBeInTheDocument()
    expect(screen.getByText(/租约截止 2026-03-27 15:05/)).toBeInTheDocument()
    expect(screen.getByText(/最近心跳 2026-03-27 15:04/)).toBeInTheDocument()
    expect(screen.getByText(/恢复 1 次/)).toBeInTheDocument()
  })

  it("locks lifecycle controls after a project has completed its current round", () => {
    const completedClosureStatus: ProjectClosureStatusRecord = {
      state: "completed",
      label: "已完成当前轮次",
      tone: "success",
      summary: "当前轮次已经自动收束，报告与最终结论都已稳定落库。",
      blockers: [],
      reportExported: true,
      finalConclusionGenerated: true,
    }

    render(
      <ProjectSchedulerRuntimePanel
        projectId="proj-runtime"
        projectStatus={"已完成" satisfies ProjectStatus}
        closureStatus={completedClosureStatus}
        initialControl={initialControl}
        initialTasks={[]}
      />,
    )

    expect(screen.getAllByText("当前轮次已经自动收束，报告与最终结论都已稳定落库。").length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "开始项目" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "暂停项目" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "继续项目" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "停止项目" })).toBeDisabled()
  })
})
