"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Activity, PauseCircle, PlayCircle, RotateCcw, Square, TimerReset } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type {
  McpSchedulerTaskRecord,
  ProjectSchedulerControl,
  ProjectSchedulerLifecycle,
} from "@/lib/prototype-types"

const taskStatusTone: Record<McpSchedulerTaskRecord["status"], "neutral" | "info" | "success" | "warning" | "danger"> = {
  ready: "info",
  waiting_approval: "warning",
  running: "info",
  retry_scheduled: "warning",
  delayed: "warning",
  completed: "success",
  failed: "danger",
  cancelled: "neutral",
}

const lifecycleToneMap: Record<ProjectSchedulerLifecycle, "neutral" | "info" | "success" | "warning" | "danger"> = {
  idle: "warning",
  running: "success",
  paused: "warning",
  stopped: "danger",
}

const lifecycleLabelMap: Record<ProjectSchedulerLifecycle, string> = {
  idle: "待开始",
  running: "运行中",
  paused: "已暂停",
  stopped: "已停止",
}

function isCancelableTask(task: McpSchedulerTaskRecord) {
  return ["ready", "retry_scheduled", "delayed", "running"].includes(task.status)
}

function isRetryableTask(task: McpSchedulerTaskRecord) {
  return task.status === "failed"
}

function getLifecycleSuccessMessage(lifecycle: ProjectSchedulerLifecycle) {
  switch (lifecycle) {
    case "idle":
      return "项目已回到待开始状态。"
    case "running":
      return "项目已开始，目标已交给 LLM 进入调度。"
    case "paused":
      return "项目已暂停，新的调度与 LLM 编排已挂起。"
    case "stopped":
      return "项目已停止，后续不会再重新开始。"
  }
}

function getLifecycleDescription(lifecycle: ProjectSchedulerLifecycle) {
  switch (lifecycle) {
    case "idle":
      return "项目还没有开始，只有在手动点击开始后，目标才会交给 LLM 生成首轮调度。"
    case "running":
      return "项目已进入运行态，LLM 会继续规划下一步，调度器会驱动 MCP 执行。"
    case "paused":
      return "项目已暂停，新的 LLM 编排和队列认领都已挂起，适合人工观察或等待窗口。"
    case "stopped":
      return "项目已终止，运行中的任务会被请求停止，后续不能重新开始。"
  }
}

export function ProjectSchedulerRuntimePanel({
  projectId,
  initialControl,
  initialTasks,
}: {
  projectId: string
  initialControl: ProjectSchedulerControl
  initialTasks: McpSchedulerTaskRecord[]
}) {
  const router = useRouter()
  const [isRouting, startTransition] = useTransition()
  const [control, setControl] = useState(initialControl)
  const [tasks, setTasks] = useState(initialTasks)
  const [activeLifecycleAction, setActiveLifecycleAction] = useState<ProjectSchedulerLifecycle | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const queuedCount = tasks.filter((task) => ["ready", "retry_scheduled", "delayed"].includes(task.status)).length
  const failedCount = tasks.filter((task) => task.status === "failed").length
  const runningCount = tasks.filter((task) => task.status === "running").length
  const canStart = control.lifecycle === "idle"
  const canPause = control.lifecycle === "running"
  const canResume = control.lifecycle === "paused"
  const canStop = control.lifecycle !== "stopped"

  function refreshServerState() {
    startTransition(() => {
      router.refresh()
    })
  }

  async function runLifecycleAction(nextLifecycle: ProjectSchedulerLifecycle) {
    setActiveLifecycleAction(nextLifecycle)
    setMessage(null)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/scheduler-control`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          lifecycle: nextLifecycle,
          note: control.note,
        }),
      })
      const payload = (await response.json()) as {
        error?: string
        schedulerControl?: ProjectSchedulerControl
      }

      if (!response.ok || !payload.schedulerControl) {
        setErrorMessage(payload.error ?? "项目生命周期更新失败，请稍后再试。")
        return
      }

      setControl(payload.schedulerControl)
      setMessage(
        nextLifecycle === "running" && control.lifecycle === "paused"
          ? "项目已恢复，调度与 LLM 编排继续执行。"
          : getLifecycleSuccessMessage(nextLifecycle),
      )
      refreshServerState()
    } catch {
      setErrorMessage("项目生命周期更新失败，请稍后再试。")
    } finally {
      setActiveLifecycleAction(null)
    }
  }

  async function runTaskAction(task: McpSchedulerTaskRecord, action: "cancel" | "retry") {
    setActiveTaskId(task.id)
    setMessage(null)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/scheduler-tasks/${task.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action,
          note: action === "cancel" ? "研究员手动取消当前排队任务。" : "研究员确认后重新排队。",
        }),
      })
      const payload = (await response.json()) as {
        error?: string
        task?: McpSchedulerTaskRecord
      }

      if (!response.ok || !payload.task) {
        setErrorMessage(payload.error ?? "调度任务操作失败，请稍后再试。")
        return
      }

      setTasks((current) => current.map((item) => (item.id === payload.task?.id ? payload.task : item)))
      setMessage(
        action === "cancel"
          ? task.status === "running"
            ? `${payload.task.target} 已记录停止请求，平台将停止后续推进。`
            : `${payload.task.target} 已从运行队列移除。`
          : `${payload.task.target} 已重新回到待执行队列。`,
      )
      refreshServerState()
    } catch {
      setErrorMessage("调度任务操作失败，请稍后再试。")
    } finally {
      setActiveTaskId(null)
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <SectionCard
        title="调度运行控制"
        description="这里的开始、暂停、继续、停止不是单纯的界面状态，而是会同步驱动后端 LLM 编排与调度状态。"
      >
        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950 dark:text-white">项目生命周期</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {getLifecycleDescription(control.lifecycle)}
                </p>
              </div>
              <StatusBadge tone={lifecycleToneMap[control.lifecycle]}>{lifecycleLabelMap[control.lifecycle]}</StatusBadge>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge tone={queuedCount > 0 ? "info" : "neutral"}>待执行 {queuedCount}</StatusBadge>
              <StatusBadge tone={runningCount > 0 ? "info" : "neutral"}>执行中 {runningCount}</StatusBadge>
              <StatusBadge tone={failedCount > 0 ? "danger" : "neutral"}>失败待恢复 {failedCount}</StatusBadge>
            </div>

            <div className="mt-5 space-y-3">
              <p className="text-sm font-medium text-slate-950 dark:text-white">调度控制备注</p>
              <Textarea
                aria-label="调度控制备注"
                value={control.note}
                onChange={(event) => setControl((current) => ({ ...current, note: event.target.value }))}
                className="min-h-24 rounded-[24px] border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-950/70"
              />
            </div>

            {message ? (
              <div className="mt-4 rounded-[20px] border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                {message}
              </div>
            ) : null}

            {errorMessage ? (
              <div className="mt-4 rounded-[20px] border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
                {errorMessage}
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Button
                type="button"
                disabled={!canStart || Boolean(activeLifecycleAction) || isRouting}
                className="rounded-full bg-slate-950 text-white hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                onClick={() => runLifecycleAction("running")}
              >
                <PlayCircle className="h-4 w-4" />
                开始项目
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!canPause || Boolean(activeLifecycleAction) || isRouting}
                className="rounded-full"
                onClick={() => runLifecycleAction("paused")}
              >
                <PauseCircle className="h-4 w-4" />
                暂停项目
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!canResume || Boolean(activeLifecycleAction) || isRouting}
                className="rounded-full"
                onClick={() => runLifecycleAction("running")}
              >
                <RotateCcw className="h-4 w-4" />
                继续项目
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!canStop || Boolean(activeLifecycleAction) || isRouting}
                className="rounded-full border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900/60 dark:text-rose-200 dark:hover:bg-rose-950/30"
                onClick={() => runLifecycleAction("stopped")}
              >
                <Square className="h-4 w-4" />
                停止项目
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <PauseCircle className="h-4 w-4" />
                <p className="text-sm font-semibold">当前状态</p>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                {lifecycleLabelMap[control.lifecycle]}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">开始后才会向 LLM 发出调度指令，停止后不可恢复。</p>
            </div>
            <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <TimerReset className="h-4 w-4" />
                <p className="text-sm font-semibold">待执行任务</p>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{queuedCount}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">包括 ready、retry_scheduled 与 delayed 三类调度候选。</p>
            </div>
            <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Activity className="h-4 w-4" />
                <p className="text-sm font-semibold">执行中</p>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{runningCount}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">运行中的 MCP 任务会继续显示在右侧真实队列表中。</p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="真实运行队列"
        description="这里是实际持久化的任务队列，不再重复展示高层流程卡片；人工接管也只在这里对真实任务生效。"
      >
        <div className="space-y-3">
          {tasks.length > 0 ? (
            tasks.map((task) => {
              const canCancel = isCancelableTask(task)
              const canRetry = isRetryableTask(task)
              const isBusy = activeTaskId === task.id || isRouting
              const cancelActionLabel = task.status === "running" ? "请求停止" : "取消排队"
              const cancelAriaLabel = task.status === "running" ? `请求停止任务 ${task.target}` : `取消任务 ${task.target}`

              return (
                <div
                  key={task.id}
                  className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-950 dark:text-white">{task.toolName}</p>
                        <StatusBadge tone={taskStatusTone[task.status]}>{task.status}</StatusBadge>
                        <StatusBadge tone={task.connectorMode === "real" ? "info" : "neutral"}>
                          {task.connectorMode === "real" ? "真实 MCP" : "本地回退"}
                        </StatusBadge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{task.target}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">
                        {task.capability}
                      </p>
                    </div>
                    <div className="text-right text-xs leading-5 text-slate-500 dark:text-slate-400">
                      <p>可执行时间 {task.availableAt}</p>
                      <p>
                        尝试 {task.attempts} / {task.maxAttempts}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                    <div className="rounded-[20px] border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                      <p className="text-xs text-slate-500 dark:text-slate-400">运行摘要</p>
                      <div className="mt-2 space-y-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {task.summaryLines.slice(-3).map((line) => (
                          <p key={`${task.id}-${line}`}>{line}</p>
                        ))}
                        {task.lastError ? (
                          <p className="text-rose-600 dark:text-rose-300">最近错误：{task.lastError}</p>
                        ) : null}
                      </div>
                      {task.workerId || task.leaseExpiresAt || task.heartbeatAt || task.recoveryCount ? (
                        <div className="mt-4 grid gap-1 rounded-[16px] border border-dashed border-slate-200/80 bg-slate-50/80 px-3 py-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
                          {task.workerId ? <p>执行 worker {task.workerId}</p> : null}
                          {task.leaseExpiresAt ? <p>租约截止 {task.leaseExpiresAt}</p> : null}
                          {task.heartbeatAt ? <p>最近心跳 {task.heartbeatAt}</p> : null}
                          {task.recoveryCount ? <p>恢复 {task.recoveryCount} 次</p> : null}
                          {task.lastRecoveredAt ? <p>最近恢复 {task.lastRecoveredAt}</p> : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={cancelAriaLabel}
                        disabled={!canCancel || isBusy}
                        className="rounded-full"
                        onClick={() => runTaskAction(task, "cancel")}
                      >
                        {cancelActionLabel}
                      </Button>
                      <Button
                        type="button"
                        variant={canRetry ? "default" : "outline"}
                        aria-label={`重试任务 ${task.target}`}
                        disabled={!canRetry || isBusy}
                        className="rounded-full"
                        onClick={() => runTaskAction(task, "retry")}
                      >
                        <RotateCcw className="h-4 w-4" />
                        重新排队
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
              当前项目还没有进入调度器的真实任务，等 MCP run 被排入运行队列后，这里会开始沉淀。
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

