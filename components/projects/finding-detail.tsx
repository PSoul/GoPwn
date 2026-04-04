"use client"

import Link from "next/link"
import { ArrowLeft, ShieldAlert } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import type { Finding, Severity, FindingStatus, Poc } from "@/lib/generated/prisma"
import { SEVERITY_LABELS, FINDING_STATUS_LABELS } from "@/lib/types/labels"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

const severityTone: Record<Severity, Tone> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "info",
  info: "neutral",
}

const statusTone: Record<FindingStatus, Tone> = {
  suspected: "warning",
  verifying: "info",
  verified: "success",
  false_positive: "neutral",
  remediated: "neutral",
}

export function FindingDetail({
  finding,
  projectId,
  poc,
}: {
  finding: Finding
  projectId: string
  poc?: Poc | null
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
              <StatusBadge tone={severityTone[finding.severity]}>{SEVERITY_LABELS[finding.severity]}</StatusBadge>
              <StatusBadge tone={statusTone[finding.status]}>{FINDING_STATUS_LABELS[finding.status]}</StatusBadge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {new Date(finding.createdAt).toLocaleDateString("zh-CN")} · {finding.affectedTarget}
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

        {finding.recommendation && (
          <div className="mt-6">
            <h2 className="text-sm font-medium text-slate-500">修复建议</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-emerald-700 dark:text-emerald-400">
              {finding.recommendation}
            </p>
          </div>
        )}

        {poc && (
          <div className="mt-6">
            <h2 className="text-sm font-medium text-slate-500">PoC</h2>
            <div className="mt-2 space-y-2">
              {poc.language && (
                <StatusBadge tone="info">{poc.language}</StatusBadge>
              )}
              <pre className="max-h-60 overflow-auto rounded-xl bg-slate-100 p-4 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200">
                {poc.code}
              </pre>
              {poc.executionOutput && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-slate-500">执行输出</p>
                  <pre className="mt-1 max-h-40 overflow-auto rounded-xl bg-slate-100 p-4 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200">
                    {poc.executionOutput}
                  </pre>
                </div>
              )}
              <StatusBadge tone={poc.succeeded ? "success" : "danger"}>
                {poc.succeeded ? "验证成功" : "验证失败"}
              </StatusBadge>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
