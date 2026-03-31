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
  autoReplan: true,
  maxRounds: 6,
  currentRound: 1,
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
        schedulerControl: {
          lifecycle: "running",
          paused: false,
          autoReplan: true,
          maxRounds: 6,
          currentRound: 0,
          note: "",
          updatedAt: "2026-03-27 15:08",
        },
      }),
    } as Response)

    render(
      <ProjectSchedulerRuntimePanel
        projectId="proj-runtime"
        projectStatus={"待处理" satisfies ProjectStatus}
        closureStatus={runningClosureStatus}
        initialControl={{ ...initialControl, lifecycle: "idle", paused: false, autoReplan: true, maxRounds: 6, currentRound: 0 }}
        initialTasks={schedulerTasks}
        initialRounds={[]}
      />,
    )

    // New compact toolbar has a "开始" button
    fireEvent.click(screen.getByRole("button", { name: /开始/ }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/projects/proj-runtime/scheduler-control",
        expect.objectContaining({ method: "PATCH" }),
      )
    })

    await waitFor(() => {
      expect(refresh).toHaveBeenCalled()
    })
  })

  it("pauses and resumes a running project through the lifecycle controls", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          schedulerControl: { ...initialControl, lifecycle: "paused", paused: true },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          schedulerControl: { ...initialControl, lifecycle: "running" },
        }),
      } as Response)

    render(
      <ProjectSchedulerRuntimePanel
        projectId="proj-runtime"
        projectStatus={"运行中" satisfies ProjectStatus}
        closureStatus={runningClosureStatus}
        initialControl={initialControl}
        initialTasks={schedulerTasks}
        initialRounds={[]}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /暂停/ }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/projects/proj-runtime/scheduler-control",
        expect.objectContaining({ method: "PATCH" }),
      )
    })

    // After pause, continue button should appear
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /继续/ })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: /继续/ }))

    await waitFor(() => {
      expect(refresh).toHaveBeenCalled()
    })
  })

  it("stops a project permanently", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        schedulerControl: { ...initialControl, lifecycle: "stopped" },
      }),
    } as Response)

    render(
      <ProjectSchedulerRuntimePanel
        projectId="proj-runtime"
        projectStatus={"运行中" satisfies ProjectStatus}
        closureStatus={runningClosureStatus}
        initialControl={initialControl}
        initialTasks={schedulerTasks}
        initialRounds={[]}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /停止/ }))

    // Confirm in the AlertDialog
    const confirmStopBtn = await screen.findByRole("button", { name: "确认停止" })
    fireEvent.click(confirmStopBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/projects/proj-runtime/scheduler-control",
        expect.objectContaining({ method: "PATCH" }),
      )
    })
  })

  it("cancels a queued scheduler task through the collapsible task queue", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        task: { ...schedulerTasks[0], status: "cancelled" },
      }),
    } as Response)

    render(
      <ProjectSchedulerRuntimePanel
        projectId="proj-runtime"
        projectStatus={"运行中" satisfies ProjectStatus}
        closureStatus={runningClosureStatus}
        initialControl={initialControl}
        initialTasks={schedulerTasks}
        initialRounds={[]}
      />,
    )

    // Expand task queue first
    fireEvent.click(screen.getByText(/任务队列/))

    // Cancel the ready task (opens AlertDialog)
    fireEvent.click(screen.getByRole("button", { name: "取消任务 api.example.test" }))

    // Confirm in the AlertDialog
    const confirmCancelBtn = await screen.findByRole("button", { name: "确认取消" })
    fireEvent.click(confirmCancelBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/projects/proj-runtime/scheduler-tasks/task-ready",
        expect.objectContaining({ method: "PATCH" }),
      )
    })
  })

  it("records a stop request for a running scheduler task", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        task: { ...schedulerTasks[2], status: "cancelled" },
      }),
    } as Response)

    render(
      <ProjectSchedulerRuntimePanel
        projectId="proj-runtime"
        projectStatus={"运行中" satisfies ProjectStatus}
        closureStatus={runningClosureStatus}
        initialControl={initialControl}
        initialTasks={schedulerTasks}
        initialRounds={[]}
      />,
    )

    // Expand task queue
    fireEvent.click(screen.getByText(/任务队列/))

    fireEvent.click(screen.getByRole("button", { name: "请求停止任务 https://portal.example.test/dashboard" }))

    // Confirm in the AlertDialog (running task shows "确认停止")
    const confirmStopTaskBtn = await screen.findByRole("button", { name: "确认停止" })
    fireEvent.click(confirmStopTaskBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/projects/proj-runtime/scheduler-tasks/task-running",
        expect.objectContaining({ method: "PATCH" }),
      )
    })
  })

  it("shows retry for failed tasks in collapsed queue", () => {
    render(
      <ProjectSchedulerRuntimePanel
        projectId="proj-runtime"
        projectStatus={"运行中" satisfies ProjectStatus}
        closureStatus={runningClosureStatus}
        initialControl={initialControl}
        initialTasks={schedulerTasks}
        initialRounds={[]}
      />,
    )

    // Expand task queue
    fireEvent.click(screen.getByText(/任务队列/))

    expect(screen.getByRole("button", { name: "重试任务 https://portal.example.test/login" })).toBeEnabled()
  })

  it("shows task error messages in the task list", () => {
    render(
      <ProjectSchedulerRuntimePanel
        projectId="proj-runtime"
        projectStatus={"运行中" satisfies ProjectStatus}
        closureStatus={runningClosureStatus}
        initialControl={initialControl}
        initialTasks={schedulerTasks}
        initialRounds={[]}
      />,
    )

    // Expand task queue
    fireEvent.click(screen.getByText(/任务队列/))

    expect(screen.getByText("temporary timeout")).toBeInTheDocument()
  })

  it("locks lifecycle controls after a project has completed", () => {
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
        initialRounds={[]}
      />,
    )

    // In terminal state, no lifecycle action buttons should be visible
    expect(screen.queryByRole("button", { name: /开始/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /暂停/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /继续/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /停止/ })).not.toBeInTheDocument()
  })
})
