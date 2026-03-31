"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { Loader2, PlayCircle } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { ProjectDetailRecord, ProjectRecord, Tone, McpSchedulerTaskRecord, OrchestratorRoundRecord, ProjectSchedulerControl } from "@/lib/prototype-types"
import { apiFetch } from "@/lib/api-client"

const metricToneStyles: Record<Tone, string> = {
  neutral: "border-slate-200/80 dark:border-slate-800",
  info: "border-sky-200/80 dark:border-sky-900/60",
  success: "border-emerald-200/80 dark:border-emerald-900/60",
  warning: "border-amber-200/80 dark:border-amber-900/60",
  danger: "border-rose-200/80 dark:border-rose-900/60",
}

export function ProjectSummary({
  project,
  detail,
}: {
  project: ProjectRecord
  detail: ProjectDetailRecord
}) {
  const router = useRouter()
  const [isStarting, setIsStarting] = useState(false)
  const [, startTransition] = useTransition()

  const isIdle = project.status === "待处理"
  const isRunning = project.status === "运行中"
  const isCompleted = project.status === "已完成"
  const isStopped = project.status === "已停止"

  // Poll operations data for running projects
  const [runningTasks, setRunningTasks] = useState<McpSchedulerTaskRecord[]>([])
  const [rounds, setRounds] = useState<OrchestratorRoundRecord[]>([])
  const [schedulerControl, setSchedulerControl] = useState<ProjectSchedulerControl | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const pollOperations = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/projects/${project.id}/operations`)
      if (!res.ok) return
      const payload = await res.json()
      if (payload.schedulerTasks) setRunningTasks(payload.schedulerTasks)
      if (payload.orchestratorRounds) setRounds(payload.orchestratorRounds)
      if (payload.schedulerControl) setSchedulerControl(payload.schedulerControl)
    } catch { /* best-effort */ }
  }, [project.id])

  useEffect(() => {
    if (isRunning) {
      void pollOperations()
      pollRef.current = setInterval(pollOperations, 5000)
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [isRunning, pollOperations])

  async function handleStartProject() {
    setIsStarting(true)
    try {
      const res = await apiFetch(`/api/projects/${project.id}/scheduler-control`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lifecycle: "running" }),
      })
      if (res.ok) {
        startTransition(() => router.refresh())
      }
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
            项目已就绪，{project.targets.length} 个目标已录入
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            点击开始后，LLM 将自动分析目标并调度 MCP 工具进行多轮探测
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

      {isRunning && (() => {
        const activeTools = runningTasks.filter((t) => t.status === "running")
        const completedCount = runningTasks.filter((t) => t.status === "completed").length
        const failedCount = runningTasks.filter((t) => t.status === "failed").length
        const waitingApproval = runningTasks.filter((t) => t.status === "waiting_approval")
        const currentRound = schedulerControl?.currentRound ?? 0
        const maxRounds = schedulerControl?.maxRounds ?? 10
        const lastRound = rounds.length > 0 ? rounds[rounds.length - 1] : null

        return (
          <div className="rounded-2xl border border-sky-200/80 bg-sky-50/60 px-5 py-4 dark:border-sky-900/60 dark:bg-sky-950/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-sky-600 dark:text-sky-400" />
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  自动化测试进行中 — 第 {currentRound}/{maxRounds} 轮
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link href={`/projects/${project.id}/operations`}>查看调度详情</Link>
              </Button>
            </div>

            {/* Current tool execution status */}
            <div className="mt-3 space-y-1.5">
              {activeTools.length > 0 ? (
                activeTools.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-xs">
                    <Loader2 className="h-3 w-3 animate-spin text-sky-500" />
                    <span className="font-medium text-sky-700 dark:text-sky-300">正在执行</span>
                    <span className="text-slate-700 dark:text-slate-200">{t.toolName}</span>
                    <span className="text-slate-400">→ {t.target}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">{detail.currentStage.summary}</p>
              )}

              {waitingApproval.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                  <span>⏳ {waitingApproval.length} 个任务等待审批</span>
                  <Link href="/approvals" className="font-medium underline hover:text-amber-800 dark:hover:text-amber-200">前往审批 →</Link>
                </div>
              )}
            </div>

            {/* Brief progress summary */}
            {(completedCount > 0 || failedCount > 0 || lastRound) && (
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                {completedCount > 0 && <span>✓ 已完成 {completedCount} 个任务</span>}
                {failedCount > 0 && <span className="text-rose-500">✗ 失败 {failedCount} 个</span>}
                {lastRound && lastRound.newAssetCount > 0 && <span className="text-sky-600 dark:text-sky-400">+{lastRound.newAssetCount} 资产</span>}
                {lastRound && lastRound.newEvidenceCount > 0 && <span className="text-sky-600 dark:text-sky-400">+{lastRound.newEvidenceCount} 证据</span>}
                {lastRound && lastRound.newFindingCount > 0 && <span className="text-amber-600 dark:text-amber-400">+{lastRound.newFindingCount} 发现</span>}
              </div>
            )}
          </div>
        )
      })()}

      {isCompleted && detail.finalConclusion && (
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 px-5 py-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">测试完成 — 最终结论</p>
              <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{detail.finalConclusion.summary}</p>
            </div>
            <StatusBadge tone="success">
              {detail.finalConclusion.source === "reviewer" ? "LLM 审阅" : "自动生成"}
            </StatusBadge>
          </div>
          {detail.finalConclusion.keyPoints.length > 0 && (
            <div className="mt-3 border-t border-emerald-200/60 pt-3 dark:border-emerald-900/40">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">关键发现</p>
              <ul className="mt-1 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                {detail.finalConclusion.keyPoints.map((point) => (
                  <li key={point}>• {point}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {isStopped && (
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">项目已停止</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail.closureStatus.summary}</p>
        </div>
      )}

      {/* Key metrics — flat row, clickable cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {detail.resultMetrics.map((metric) => {
          const hrefMap: Record<string, string> = {
            "已纳入域名": `/projects/${project.id}/results/domains`,
            "开放端口": `/projects/${project.id}/results/network`,
            "漏洞线索": `/projects/${project.id}/results/findings`,
            "证据锚点": `/projects/${project.id}/context`,
          }
          const href = hrefMap[metric.label]
          return (
            <Link
              key={metric.label}
              href={href ?? `/projects/${project.id}`}
              className={`block rounded-xl border bg-white p-3 transition-colors hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900 ${metricToneStyles[metric.tone]}`}
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">{metric.label}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{metric.value}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{metric.note}</p>
            </Link>
          )
        })}
      </div>

      {/* Recent activity — simplified */}
      {detail.activity.length > 0 && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-950 dark:text-white">最近动态</p>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link href={`/projects/${project.id}/context`}>查看全部</Link>
            </Button>
          </div>
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {detail.activity.slice(0, 5).map((item) => (
              <div key={`${item.title}-${item.meta}`} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm text-slate-900 dark:text-white">{item.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.detail}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{item.meta}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
