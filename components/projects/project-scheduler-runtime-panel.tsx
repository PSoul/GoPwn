"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Activity, PauseCircle, RotateCcw, TimerReset } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { McpSchedulerTaskRecord, ProjectSchedulerControl } from "@/lib/prototype-types"

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

function isCancelableTask(task: McpSchedulerTaskRecord) {
  return ["ready", "retry_scheduled", "delayed"].includes(task.status)
}

function isRetryableTask(task: McpSchedulerTaskRecord) {
  return task.status === "failed"
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
  const [isSavingControl, setIsSavingControl] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const queuedCount = tasks.filter((task) => ["ready", "retry_scheduled", "delayed"].includes(task.status)).length
  const failedCount = tasks.filter((task) => task.status === "failed").length
  const runningCount = tasks.filter((task) => task.status === "running").length

  function refreshServerState() {
    startTransition(() => {
      router.refresh()
    })
  }

  async function saveSchedulerControl() {
    setIsSavingControl(true)
    setMessage(null)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/scheduler-control`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          paused: control.paused,
          note: control.note,
        }),
      })
      const payload = (await response.json()) as {
        error?: string
        schedulerControl?: ProjectSchedulerControl
      }

      if (!response.ok || !payload.schedulerControl) {
        setErrorMessage(payload.error ?? "调度控制保存失败，请稍后再试。")
        return
      }

      setControl(payload.schedulerControl)
      setMessage(payload.schedulerControl.paused ? "项目调度已暂停" : "项目调度已恢复")
      refreshServerState()
    } catch {
      setErrorMessage("调度控制保存失败，请稍后再试。")
    } finally {
      setIsSavingControl(false)
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
          ? `${payload.task.target} 已从运行队列移除。`
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
        description="审批负责是否允许执行，调度负责何时执行、是否暂停、以及失败任务如何恢复，这里只承载运行时控制。"
      >
        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950 dark:text-white">项目调度开关</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  暂停后不会继续认领 ready、retry 或 delayed 任务，但不会中断已经在执行中的短流程。
                </p>
              </div>
              <Switch
                checked={control.paused}
                aria-label="项目调度开关"
                onCheckedChange={(checked) => setControl((current) => ({ ...current, paused: checked }))}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge tone={control.paused ? "warning" : "success"}>
                {control.paused ? "调度暂停中" : "调度已开启"}
              </StatusBadge>
              <StatusBadge tone={queuedCount > 0 ? "info" : "neutral"}>待执行 {queuedCount}</StatusBadge>
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

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                disabled={isSavingControl || isRouting}
                className="rounded-full bg-slate-950 text-white hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                onClick={saveSchedulerControl}
              >
                {isSavingControl ? "保存中..." : "保存调度控制"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSavingControl || isRouting}
                className="rounded-full"
                onClick={() =>
                  setControl({
                    paused: false,
                    note: "恢复默认调度：允许处理 ready / retry / delayed 任务，适合继续自动补采与结果回流。",
                    updatedAt: control.updatedAt,
                  })
                }
              >
                恢复建议配置
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <PauseCircle className="h-4 w-4" />
                <p className="text-sm font-semibold">调度状态</p>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                {control.paused ? "暂停" : "运行"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">项目级调度只影响后续队列认领，不改变审批决策本身。</p>
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
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">当前正在消耗 MCP 执行窗口的任务数量。</p>
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
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={`取消任务 ${task.target}`}
                        disabled={!canCancel || isBusy}
                        className="rounded-full"
                        onClick={() => runTaskAction(task, "cancel")}
                      >
                        取消排队
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
