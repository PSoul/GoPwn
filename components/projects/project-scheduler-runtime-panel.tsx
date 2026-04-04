"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, PlayCircle, Square } from "lucide-react"

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { Project, ProjectLifecycle } from "@/lib/generated/prisma"
import { LIFECYCLE_LABELS } from "@/lib/types/labels"
import { apiFetch } from "@/lib/infra/api-client"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

const lifecycleTone: Record<ProjectLifecycle, Tone> = {
  idle: "neutral",
  planning: "info",
  executing: "info",
  waiting_approval: "warning",
  reviewing: "warning",
  settling: "success",
  stopping: "warning",
  stopped: "neutral",
  completed: "success",
  failed: "danger",
}

/**
 * Simplified scheduler panel.
 * The backend now uses pg-boss for task scheduling. This panel shows
 * lifecycle status and provides start/pause/stop controls.
 */
export function ProjectSchedulerRuntimePanel({
  project,
}: {
  project: Project
}) {
  const router = useRouter()
  const [lifecycle, setLifecycle] = useState(project.lifecycle)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pendingStop, setPendingStop] = useState(false)

  const isTerminal = lifecycle === "completed" || lifecycle === "stopped" || lifecycle === "failed"
  const canStart = lifecycle === "idle" || lifecycle === "stopped" || lifecycle === "failed"
  const canStop = !isTerminal && lifecycle !== "stopping"

  async function runLifecycleAction(action: "start" | "stop") {
    setActiveAction(action)
    setMessage(null)
    try {
      const payload = await apiFetch<{ lifecycle: string }>(`/api/projects/${project.id}/${action}`, {
        method: "POST",
      })
      if (payload.lifecycle) {
        setLifecycle(payload.lifecycle as ProjectLifecycle)
        setMessage(action === "start" ? "项目已开始运行" : "已停止")
        router.refresh()
      }
    } catch { /* best-effort */ } finally {
      setActiveAction(null)
    }
  }

  return (
    <div className="space-y-4" data-testid="scheduler-runtime-panel">
      <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StatusBadge tone={lifecycleTone[lifecycle]}>{LIFECYCLE_LABELS[lifecycle]}</StatusBadge>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              轮次 {project.currentRound}/{project.maxRounds}
            </span>
            {(lifecycle === "executing" || lifecycle === "planning") && (
              <span className="flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400">
                <Loader2 className="h-3 w-3 animate-spin" /> pg-boss 调度中
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canStart && (
              <Button size="sm" className="rounded-full bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400" disabled={Boolean(activeAction)} onClick={() => runLifecycleAction("start")}>
                <PlayCircle className="mr-1 h-3.5 w-3.5" /> {lifecycle === "idle" ? "开始" : "重新启动"}
              </Button>
            )}
            {canStop && (
              <Button variant="outline" size="sm" className="rounded-full text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30" disabled={Boolean(activeAction)} onClick={() => setPendingStop(true)}>
                <Square className="mr-1 h-3.5 w-3.5" /> 停止
              </Button>
            )}
          </div>
        </div>
        {message && <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{message}</p>}
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          任务调度由 pg-boss 负责，具体任务状态请查看 MCP 执行记录面板。
        </p>
      </div>

      <AlertDialog open={pendingStop} onOpenChange={(open) => { if (!open) setPendingStop(false) }}>
        <AlertDialogContent className="rounded-2xl border-slate-200 dark:border-slate-800">
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
              onClick={() => { void runLifecycleAction("stop"); setPendingStop(false) }}
            >
              确认停止
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
