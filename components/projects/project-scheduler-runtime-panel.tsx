"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, Loader2, PauseCircle, PlayCircle, Square } from "lucide-react"

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { StubBadge } from "@/components/ui/stub-badge"
import { Button } from "@/components/ui/button"
import type {
  ProjectClosureStatusRecord,
  McpSchedulerTaskRecord,
  OrchestratorRoundRecord,
  ProjectSchedulerControl,
  ProjectSchedulerLifecycle,
  ProjectStatus,
} from "@/lib/prototype-types"
import { apiFetch } from "@/lib/infra/api-client"

const lifecycleLabelMap: Record<ProjectSchedulerLifecycle, string> = {
  idle: "待开始",
  running: "运行中",
  paused: "已暂停",
  stopped: "已停止",
}

const lifecycleToneMap: Record<ProjectSchedulerLifecycle, "neutral" | "info" | "success" | "warning" | "danger"> = {
  idle: "warning",
  running: "success",
  paused: "warning",
  stopped: "danger",
}

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

export function ProjectSchedulerRuntimePanel({
  projectId,
  projectStatus,
  closureStatus,
  initialControl,
  initialTasks,
  initialRounds,
}: {
  projectId: string
  projectStatus: ProjectStatus
  closureStatus: ProjectClosureStatusRecord
  initialControl: ProjectSchedulerControl
  initialTasks: McpSchedulerTaskRecord[]
  initialRounds: OrchestratorRoundRecord[]
}) {
  const router = useRouter()
  const [isRouting, startTransition] = useTransition()
  const [control, setControl] = useState(initialControl)
  const [tasks, setTasks] = useState(initialTasks)
  const [rounds, setRounds] = useState<OrchestratorRoundRecord[]>(initialRounds)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [expandedRounds, setExpandedRounds] = useState(false)
  const [expandedTasks, setExpandedTasks] = useState(false)
  const [pendingCancel, setPendingCancel] = useState<McpSchedulerTaskRecord | null>(null)
  const [pendingStop, setPendingStop] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isTerminal = projectStatus === "已完成" || projectStatus === "已停止" || ["completed", "stopped"].includes(closureStatus.state)
  const lifecycleTone = isTerminal ? closureStatus.tone : lifecycleToneMap[control.lifecycle]
  const lifecycleLabel = isTerminal ? closureStatus.label : lifecycleLabelMap[control.lifecycle]

  const canStart = control.lifecycle === "idle" && !isTerminal
  const canPause = control.lifecycle === "running" && !isTerminal
  const canResume = control.lifecycle === "paused" && !isTerminal
  const canStop = control.lifecycle !== "stopped" && !isTerminal

  const queuedCount = tasks.filter((t) => ["ready", "retry_scheduled", "delayed"].includes(t.status)).length
  const runningCount = tasks.filter((t) => t.status === "running").length
  const failedCount = tasks.filter((t) => t.status === "failed").length

  const pollOperations = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/projects/${projectId}/operations`)
      if (!res.ok) return
      const payload = await res.json()
      if (payload.schedulerControl) setControl(payload.schedulerControl)
      if (payload.schedulerTasks) setTasks(payload.schedulerTasks)
      if (payload.orchestratorRounds) setRounds(payload.orchestratorRounds)
    } catch { /* best-effort */ }
  }, [projectId])

  useEffect(() => {
    if (control.lifecycle === "running") {
      pollingRef.current = setInterval(pollOperations, 5000)
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [control.lifecycle, pollOperations])

  async function runLifecycleAction(nextLifecycle: ProjectSchedulerLifecycle) {
    setActiveAction(nextLifecycle)
    setMessage(null)
    try {
      const res = await apiFetch(`/api/projects/${projectId}/scheduler-control`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lifecycle: nextLifecycle, note: control.note }),
      })
      const payload = await res.json()
      if (res.ok && payload.schedulerControl) {
        setControl(payload.schedulerControl)
        setMessage(nextLifecycle === "running" ? "项目已开始运行" : nextLifecycle === "paused" ? "已暂停" : nextLifecycle === "stopped" ? "已停止" : "")
        startTransition(() => router.refresh())
      }
    } catch { /* best-effort */ } finally {
      setActiveAction(null)
    }
  }

  async function runTaskAction(task: McpSchedulerTaskRecord, action: "cancel" | "retry") {
    setActiveAction(task.id)
    try {
      const res = await apiFetch(`/api/projects/${projectId}/scheduler-tasks/${task.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, note: action === "cancel" ? "手动取消" : "手动重试" }),
      })
      const payload = await res.json()
      if (res.ok && payload.task) {
        setTasks((prev) => prev.map((t) => (t.id === payload.task?.id ? payload.task : t)))
        startTransition(() => router.refresh())
      }
    } catch { /* best-effort */ } finally {
      setActiveAction(null)
    }
  }

  return (
    <div className="space-y-4" data-testid="scheduler-runtime-panel">
      {/* Compact lifecycle toolbar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StatusBadge tone={lifecycleTone}>{lifecycleLabel}</StatusBadge>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              轮次 {control.currentRound}/{control.maxRounds}
            </span>
            {runningCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400">
                <Loader2 className="h-3 w-3 animate-spin" /> {runningCount} 个任务执行中
              </span>
            )}
            {queuedCount > 0 && <span className="text-xs text-slate-500">· {queuedCount} 个待执行</span>}
            {failedCount > 0 && <span className="text-xs text-rose-600 dark:text-rose-400">· {failedCount} 个失败</span>}
          </div>
          <div className="flex items-center gap-2">
            {canStart && (
              <Button size="sm" className="rounded-full bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400" disabled={Boolean(activeAction) || isRouting} onClick={() => runLifecycleAction("running")}>
                <PlayCircle className="mr-1 h-3.5 w-3.5" /> 开始
              </Button>
            )}
            {canPause && (
              <Button variant="outline" size="sm" className="rounded-full" disabled={Boolean(activeAction) || isRouting} onClick={() => runLifecycleAction("paused")}>
                <PauseCircle className="mr-1 h-3.5 w-3.5" /> 暂停
              </Button>
            )}
            {canResume && (
              <Button size="sm" className="rounded-full bg-sky-600 text-white hover:bg-sky-700" disabled={Boolean(activeAction) || isRouting} onClick={() => runLifecycleAction("running")}>
                <PlayCircle className="mr-1 h-3.5 w-3.5" /> 继续
              </Button>
            )}
            {canStop && (
              <Button variant="outline" size="sm" className="rounded-full text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30" disabled={Boolean(activeAction) || isRouting} onClick={() => setPendingStop(true)}>
                <Square className="mr-1 h-3.5 w-3.5" /> 停止
              </Button>
            )}
          </div>
        </div>
        {message && <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{message}</p>}
      </div>

      {/* Orchestration rounds — compact timeline */}
      {rounds.length > 0 && (
        <div className="rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950">
          <button
            type="button"
            className="flex w-full items-center justify-between px-5 py-3 text-left"
            onClick={() => setExpandedRounds(!expandedRounds)}
          >
            <span className="text-sm font-medium text-slate-950 dark:text-white">AI 规划轮次 ({rounds.length})</span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expandedRounds ? "rotate-180" : ""}`} />
          </button>
          {expandedRounds && (
            <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-800">
              <div className="space-y-2">
                {rounds.map((round) => (
                  <div key={round.round} className="flex items-center gap-4 text-sm">
                    <span className="w-16 shrink-0 font-medium text-slate-900 dark:text-white">第 {round.round} 轮</span>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs text-slate-500">计划 {round.planItemCount}</span>
                      <span className="text-xs text-slate-500">执行 {round.executedCount}</span>
                      {round.newAssetCount > 0 && <span className="text-xs text-sky-600 dark:text-sky-400">+{round.newAssetCount} 资产</span>}
                      {round.newEvidenceCount > 0 && <span className="text-xs text-sky-600 dark:text-sky-400">+{round.newEvidenceCount} 证据</span>}
                      {round.newFindingCount > 0 && <span className="text-xs text-amber-600 dark:text-amber-400">+{round.newFindingCount} 发现</span>}
                      {round.failedActions.length > 0 && <span className="text-xs text-rose-600">失败 {round.failedActions.length}</span>}
                    </div>
                    <span className="ml-auto text-xs text-slate-400">{round.completedAt || round.startedAt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {control.lifecycle === "running" && (() => {
            const lastRound = rounds.length > 0 ? rounds[rounds.length - 1].round : 0
            return lastRound < control.maxRounds ? (
              <div className="border-t border-slate-100 px-5 py-2.5 dark:border-slate-800">
                <span className="flex items-center gap-2 text-xs text-sky-600 dark:text-sky-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  正在规划第 {lastRound + 1} 轮...
                </span>
              </div>
            ) : (
              <div className="border-t border-slate-100 px-5 py-2.5 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  已达到最大轮次限制 ({control.maxRounds})，正在自动收尾...
                </span>
              </div>
            )
          })()}
        </div>
      )}

      {/* Task queue — collapsible */}
      {tasks.length > 0 && (
        <div className="rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950">
          <button
            type="button"
            className="flex w-full items-center justify-between px-5 py-3 text-left"
            onClick={() => setExpandedTasks(!expandedTasks)}
          >
            <span className="text-sm font-medium text-slate-950 dark:text-white">任务队列 ({tasks.length})</span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expandedTasks ? "rotate-180" : ""}`} />
          </button>
          {expandedTasks && (
            <div className="border-t border-slate-100 dark:border-slate-800">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {tasks.map((task) => {
                  const canCancel = ["ready", "retry_scheduled", "delayed", "running"].includes(task.status)
                  const canRetry = task.status === "failed"
                  const isBusy = activeAction === task.id || isRouting
                  return (
                    <div key={task.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{task.toolName}</span>
                          <StatusBadge tone={taskStatusTone[task.status]}>{task.status}</StatusBadge>
                          <StubBadge mode={task.connectorMode} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{task.target}</p>
                        {task.status === "waiting_approval" && (
                          <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                            需要审批后才能继续执行。
                            <Link href={`/projects/${projectId}/operations`} className="ml-1 font-medium underline hover:text-amber-800 dark:hover:text-amber-200">查看审批 →</Link>
                          </p>
                        )}
                        {task.lastError && <p className="mt-0.5 text-xs text-rose-600 dark:text-rose-400">{task.lastError}</p>}
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        {canCancel && (
                          <Button variant="ghost" size="sm" className="h-7 rounded-full text-xs" disabled={isBusy}
                            aria-label={task.status === "running" ? `请求停止任务 ${task.target}` : `取消任务 ${task.target}`}
                            onClick={() => setPendingCancel(task)}
                          >
                            {task.status === "running" ? "停止" : "取消"}
                          </Button>
                        )}
                        {canRetry && (
                          <Button variant="ghost" size="sm" className="h-7 rounded-full text-xs" disabled={isBusy}
                            aria-label={`重试任务 ${task.target}`}
                            onClick={() => runTaskAction(task, "retry")}
                          >
                            重试
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={pendingStop} onOpenChange={(open) => { if (!open) setPendingStop(false) }}>
        <AlertDialogContent className="rounded-card border-slate-200 dark:border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle>确认停止项目</AlertDialogTitle>
            <AlertDialogDescription>
              停止后项目执行引擎将不再执行新任务，已完成的任务结果会保留。此操作需要谨慎评估。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => { void runLifecycleAction("stopped"); setPendingStop(false) }}
            >
              确认停止
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(pendingCancel)} onOpenChange={(open) => { if (!open) setPendingCancel(null) }}>
        <AlertDialogContent className="rounded-card border-slate-200 dark:border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingCancel?.status === "running" ? "确认停止运行中的任务" : "确认取消排队任务"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              即将{pendingCancel?.status === "running" ? "停止" : "取消"}任务 {pendingCancel?.toolName}（目标：{pendingCancel?.target}）。此操作不可撤回。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">返回</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => { if (pendingCancel) void runTaskAction(pendingCancel, "cancel"); setPendingCancel(null) }}
            >
              确认{pendingCancel?.status === "running" ? "停止" : "取消"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
