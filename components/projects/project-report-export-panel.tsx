"use client"

import { useState } from "react"
import { Download, FileText } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { ProjectReportExportActionPayload, ProjectReportExportPayload } from "@/lib/prototype-types"

function buildDispatchMessage(payload: ProjectReportExportActionPayload) {
  if (payload.dispatch.approval || payload.dispatch.run.status === "待审批") {
    return `报告导出已进入审批：${payload.dispatch.approval?.id ?? payload.dispatch.run.linkedApprovalId ?? "待确认"}。`
  }

  if (payload.dispatch.run.status === "已阻塞") {
    return payload.dispatch.run.summaryLines.at(-1) ?? "报告导出被阻塞，请先恢复相关 MCP 工具。"
  }

  return "报告导出已完成，最新结果已回流。"
}

export function ProjectReportExportPanel({
  projectId,
  initialPayload,
}: {
  projectId: string
  initialPayload: ProjectReportExportPayload
}) {
  const [payload, setPayload] = useState(initialPayload)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function triggerReportExport() {
    setIsSubmitting(true)
    setMessage(null)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/report-export`, {
        method: "POST",
      })
      const body = (await response.json()) as (ProjectReportExportActionPayload & { error?: string }) | { error?: string }

      if (!response.ok || !("dispatch" in body)) {
        setErrorMessage(body.error ?? "报告导出失败，请稍后再试。")
        return
      }

      setPayload(body.reportExport)
      setMessage(buildDispatchMessage(body))
    } catch {
      setErrorMessage("报告导出失败，请稍后再试。")
    } finally {
      setIsSubmitting(false)
    }
  }

  const latest = payload.latest
  const finalConclusion = payload.finalConclusion

  return (
    <SectionCard
      title="报告导出"
      description="这里提供可见的闭环出口。触发后会走 MCP 调度链路，并把最新导出摘要回写到项目操作页。"
    >
      <div className="grid gap-4 xl:grid-cols-[0.76fr_1.24fr]">
        <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <Download className="h-4 w-4" />
            <p className="text-sm font-semibold">闭环导出入口</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            在项目操作页直接触发一次报告导出，并查看最近一次导出的摘要、产物计数和结果要点。
          </p>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-[20px] border border-slate-200/80 bg-white/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">导出次数</p>
              <p className="text-lg font-semibold text-slate-950 dark:text-white">{payload.totalExports}</p>
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
        </div>

        <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
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
              <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                {latest.summary}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-[18px] border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">资产</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">{latest.assetCount}</p>
                </div>
                <div className="rounded-[18px] border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">证据</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">{latest.evidenceCount}</p>
                </div>
                <div className="rounded-[18px] border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">漏洞与发现</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">{latest.findingCount}</p>
                </div>
              </div>

              <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="text-sm font-semibold text-slate-950 dark:text-white">导出摘要</p>
                <div className="mt-2 space-y-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {latest.digestLines.length > 0 ? (
                    latest.digestLines.map((line) => <p key={`${latest.id}-${line}`}>{line}</p>)
                  ) : (
                    <p>暂无额外摘要。</p>
                  )}
                </div>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">导出时间：{latest.exportedAt}</p>
              </div>

              {finalConclusion ? (
                <div className="rounded-[20px] border border-emerald-200/80 bg-emerald-50/80 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">最终结论</p>
                    <StatusBadge tone={finalConclusion.source === "reviewer" ? "success" : "info"}>
                      {finalConclusion.source === "reviewer" ? "LLM 审阅" : "本地回退"}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{finalConclusion.summary}</p>
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">生成时间：{finalConclusion.generatedAt}</p>
                </div>
              ) : latest.conclusionSummary ? (
                <div className="rounded-[20px] border border-emerald-200/80 bg-emerald-50/80 p-4 text-sm leading-6 text-slate-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-slate-200">
                  {latest.conclusionSummary}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-[20px] border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
              当前项目还没有导出记录。点击“导出项目报告”后，这里会展示最新闭环结果。
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  )
}
