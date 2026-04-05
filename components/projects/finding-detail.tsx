"use client"

import Link from "next/link"
import { ArrowLeft, ShieldAlert } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import type { Finding, Severity, Poc } from "@/lib/generated/prisma"
import { SEVERITY_LABELS } from "@/lib/types/labels"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

const severityTone: Record<Severity, Tone> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "info",
  info: "neutral",
}

type Props = {
  finding: Finding
  projectId: string
  poc?: Poc | null
  evidence?: { title: string; toolName: string; rawOutput: string } | null
}

export function FindingDetail({ finding, projectId, poc, evidence }: Props) {
  return (
    <div className="space-y-6">
      <Link
        href={`/projects/${projectId}/findings`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        返回漏洞列表
      </Link>

      <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 dark:border-slate-800 dark:bg-slate-950/70">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-slate-400" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-950 dark:text-white">{finding.title}</h1>
              <StatusBadge tone={severityTone[finding.severity]}>{SEVERITY_LABELS[finding.severity]}</StatusBadge>
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

        {/* Raw Evidence — collapsed by default */}
        {evidence && evidence.rawOutput && (
          <details className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
            <summary className="text-sm font-medium text-slate-500 cursor-pointer hover:text-slate-900 dark:hover:text-slate-100">
              原始证据 — {evidence.toolName}
            </summary>
            <pre className="mt-2 rounded-xl bg-slate-100 p-3 text-xs text-slate-700 max-h-96 overflow-auto whitespace-pre-wrap dark:bg-slate-900 dark:text-slate-300">
              {evidence.rawOutput}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
