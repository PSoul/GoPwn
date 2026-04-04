"use client"

import Link from "next/link"
import { ArrowLeft, ShieldAlert } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import type { ProjectFindingRecord } from "@/lib/prototype-types"

const severityTone = {
  "高危": "danger",
  "中危": "warning",
  "低危": "info",
  "信息": "neutral",
} as const

export function FindingDetail({
  finding,
  projectId,
}: {
  finding: ProjectFindingRecord
  projectId: string
}) {
  return (
    <div className="space-y-6">
      <Link
        href={`/projects/${projectId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        返回项目
      </Link>

      <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 dark:border-slate-800 dark:bg-slate-950/70">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-slate-400" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-950 dark:text-white">{finding.title}</h1>
              <StatusBadge tone={severityTone[finding.severity]}>{finding.severity}</StatusBadge>
              <StatusBadge tone="neutral">{finding.status}</StatusBadge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {finding.createdAt} · {finding.affectedSurface}
            </p>
          </div>
        </div>

        {finding.summary && (
          <div className="mt-6">
            <h2 className="text-sm font-medium text-slate-500">摘要</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">
              {finding.summary}
            </p>
          </div>
        )}

        {finding.remediationNote && (
          <div className="mt-6">
            <h2 className="text-sm font-medium text-slate-500">修复建议</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-emerald-700 dark:text-emerald-400">
              {finding.remediationNote}
            </p>
          </div>
        )}

        {finding.rawInput && (
          <div className="mt-6">
            <h2 className="text-sm font-medium text-slate-500">原始输入</h2>
            <pre className="mt-1 max-h-60 overflow-auto rounded-xl bg-slate-100 p-4 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200">
              {finding.rawInput}
            </pre>
          </div>
        )}

        {finding.rawOutput.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-medium text-slate-500">原始输出</h2>
            <pre className="mt-1 max-h-80 overflow-auto rounded-xl bg-slate-100 p-4 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200">
              {finding.rawOutput.join("\n")}
            </pre>
          </div>
        )}

        {finding.capturedUrl && (
          <div className="mt-6">
            <h2 className="text-sm font-medium text-slate-500">捕获 URL</h2>
            <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">{finding.capturedUrl}</p>
          </div>
        )}

        {finding.screenshotPath && (
          <div className="mt-6">
            <h2 className="text-sm font-medium text-slate-500">截图</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{finding.screenshotPath}</p>
          </div>
        )}
      </div>
    </div>
  )
}
