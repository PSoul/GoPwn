"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Loader2, PlayCircle } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { ProjectDetailRecord, ProjectRecord, Tone } from "@/lib/prototype-types"

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

  async function handleStartProject() {
    setIsStarting(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/scheduler-control`, {
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

      {isRunning && (
        <div className="rounded-2xl border border-sky-200/80 bg-sky-50/60 px-5 py-4 dark:border-sky-900/60 dark:bg-sky-950/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-sky-600 dark:text-sky-400" />
              <p className="text-sm font-medium text-slate-900 dark:text-white">自动化测试进行中</p>
            </div>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href={`/projects/${project.id}/operations`}>查看调度详情</Link>
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {detail.currentStage.summary}
          </p>
        </div>
      )}

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

      {/* Key metrics — flat row, no nested cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {detail.resultMetrics.map((metric) => (
          <div key={metric.label} className={`rounded-xl border bg-white p-3 dark:bg-slate-950 ${metricToneStyles[metric.tone]}`}>
            <p className="text-xs text-slate-500 dark:text-slate-400">{metric.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{metric.value}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{metric.note}</p>
          </div>
        ))}
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
