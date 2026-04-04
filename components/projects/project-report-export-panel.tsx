"use client"

import { useState } from "react"
import { Download, FileText } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/infra/api-client"

type ReportExportResult = {
  id: string
  summary: string
  assetCount: number
  findingCount: number
  exportedAt: string
}

export function ProjectReportExportPanel({
  projectId,
  latestExport,
  totalExports,
}: {
  projectId: string
  latestExport?: ReportExportResult | null
  totalExports: number
}) {
  const [latest, setLatest] = useState(latestExport ?? null)
  const [count, setCount] = useState(totalExports)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function triggerReportExport() {
    setIsSubmitting(true)
    setMessage(null)
    setErrorMessage(null)

    try {
      const payload = await apiFetch<{ export?: ReportExportResult; totalExports?: number; error?: string }>(
        `/api/projects/${projectId}/report-export`,
        { method: "POST" },
      )

      if (payload.export) {
        setLatest(payload.export)
        setCount(payload.totalExports ?? count + 1)
        setMessage("报告导出已完成。")
      } else {
        setErrorMessage(payload.error ?? "报告导出失败，请稍后再试。")
      }
    } catch {
      setErrorMessage("报告导出失败，请稍后再试。")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SectionCard
      title="报告导出"
      description="触发报告导出，查看最新导出摘要和产物计数。"
    >
      <div className="grid gap-4 xl:grid-cols-[0.76fr_1.24fr]">
        <div className="rounded-panel border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <Download className="h-4 w-4" />
            <p className="text-sm font-semibold">导出入口</p>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">导出次数</p>
              <p className="text-lg font-semibold text-slate-950 dark:text-white">{count}</p>
            </div>
            <Button
              type="button"
              className="rounded-full"
              disabled={isSubmitting}
              onClick={triggerReportExport}
            >
              {isSubmitting ? "导出中..." : "导出项目报告"}
            </Button>
          </div>
          {message && (
            <div className="mt-4 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
              {message}
            </div>
          )}
          {errorMessage && (
            <div className="mt-4 rounded-xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="rounded-panel border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <FileText className="h-4 w-4" />
              <p className="text-sm font-semibold">最近一次导出结果</p>
            </div>
            <StatusBadge tone={latest ? "success" : "neutral"}>
              {latest ? "已生成" : "暂无导出"}
            </StatusBadge>
          </div>

          {latest ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                {latest.summary}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">资产</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">{latest.assetCount}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">漏洞与发现</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">{latest.findingCount}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">导出时间：{latest.exportedAt}</p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
              当前项目还没有导出记录。点击&ldquo;导出项目报告&rdquo;后，这里会展示最新结果。
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  )
}
