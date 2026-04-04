"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Loader2, PlayCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Project } from "@/lib/generated/prisma"
import { PHASE_LABELS } from "@/lib/types/labels"
import { apiFetch } from "@/lib/infra/api-client"

export function ProjectSummary({
  project,
}: {
  project: Project
}) {
  const router = useRouter()
  const [isStarting, setIsStarting] = useState(false)
  const [, startTransition] = useTransition()

  const isIdle = project.lifecycle === "idle"
  const isRunning = ["planning", "executing", "waiting_approval", "reviewing", "settling"].includes(project.lifecycle)
  const isCompleted = project.lifecycle === "completed"
  const isStopped = project.lifecycle === "stopped"
  const isFailed = project.lifecycle === "failed"
  const canRestart = isStopped || isFailed

  async function handleStartProject() {
    setIsStarting(true)
    try {
      await apiFetch(`/api/projects/${project.id}/start`, { method: "POST" })
      startTransition(() => router.refresh())
    } catch { /* best-effort */ } finally {
      setIsStarting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* State-aware action area */}
      {isIdle && (
        <div className="rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/60 p-6 text-center dark:border-sky-800 dark:bg-sky-950/20">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            项目已就绪
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            点击开始后，LLM 将自动分析目标并调度探测工具进行多轮探测
          </p>
          <Button
            onClick={handleStartProject}
            disabled={isStarting}
            className="mt-4 rounded-full bg-sky-600 px-8 text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
          >
            {isStarting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />启动中...</>
            ) : (
              <><PlayCircle className="mr-2 h-4 w-4" />开始自动化测试</>
            )}
          </Button>
        </div>
      )}

      {isRunning && (
        <div className="rounded-2xl border border-sky-200/80 bg-sky-50/60 px-5 py-4 dark:border-sky-900/60 dark:bg-sky-950/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-sky-600 dark:text-sky-400" />
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                自动化测试进行中 -- 第 {project.currentRound}/{project.maxRounds} 轮 -- {PHASE_LABELS[project.currentPhase]}
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href={`/projects/${project.id}/operations`}>查看调度详情</Link>
            </Button>
          </div>
        </div>
      )}

      {isCompleted && (
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 px-5 py-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
            测试完成 -- 共进行 {project.currentRound} 轮
          </p>
        </div>
      )}

      {canRestart && (
        <div className={`rounded-2xl border px-5 py-4 ${isFailed ? "border-rose-200/80 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/20" : "border-slate-200/80 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40"}`}>
          <div className="flex items-center justify-between gap-3">
            <p className={`text-sm font-medium ${isFailed ? "text-rose-700 dark:text-rose-300" : "text-slate-600 dark:text-slate-300"}`}>
              {isFailed ? "项目执行失败" : "项目已停止"}
            </p>
            <Button
              onClick={handleStartProject}
              disabled={isStarting}
              variant="outline"
              size="sm"
              className="rounded-full"
            >
              {isStarting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />重启中...</>
              ) : (
                <><PlayCircle className="mr-2 h-4 w-4" />重新启动</>
              )}
            </Button>
          </div>
        </div>
      )}

    </div>
  )
}
