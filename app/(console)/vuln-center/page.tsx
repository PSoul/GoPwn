import Link from "next/link"

import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { prisma } from "@/lib/infra/prisma"
import { SEVERITY_LABELS, FINDING_STATUS_LABELS } from "@/lib/types/labels"

export default async function VulnCenterPage() {
  const findings = await prisma.finding.findMany({
    include: { asset: true, project: true },
    orderBy: { createdAt: "desc" },
  })

  const total = findings.length
  const bySeverity = {
    critical: findings.filter((f) => f.severity === "critical").length,
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
    info: findings.filter((f) => f.severity === "info").length,
  }
  const pendingCount = findings.filter((f) => f.status === "suspected" || f.status === "verifying").length

  const severityTone = {
    critical: "danger",
    high: "danger",
    medium: "warning",
    low: "info",
    info: "neutral",
  } as const

  return (
    <div className="space-y-6">
      <PageHeader
        title="漏洞中心"
        description="跨项目漏洞总览，一目了然看清所有待处理发现。"
        actions={
          <StatusBadge tone="warning">{pendingCount} 个待验证</StatusBadge>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">漏洞总数</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{total}</p>
        </div>
        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">高危+严重</p>
          <p className="mt-2 text-3xl font-semibold text-rose-600 dark:text-rose-400">{bySeverity.critical + bySeverity.high}</p>
        </div>
        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">中危</p>
          <p className="mt-2 text-3xl font-semibold text-amber-600 dark:text-amber-400">{bySeverity.medium}</p>
        </div>
        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">低危/信息</p>
          <p className="mt-2 text-3xl font-semibold text-slate-600 dark:text-slate-300">{bySeverity.low + bySeverity.info}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950">
        {findings.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
            还没有发现漏洞。等项目执行后，LLM 发现和人工验证的结果会汇总到这里。
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {findings.map((finding) => (
              <Link
                key={finding.id}
                href={`/projects/${finding.projectId}/vuln/${finding.id}`}
                className="flex w-full items-center gap-4 px-5 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
              >
                <div className={`h-8 w-1 shrink-0 rounded-full ${
                  finding.severity === "critical" || finding.severity === "high" ? "bg-rose-500" :
                  finding.severity === "medium" ? "bg-amber-500" :
                  finding.severity === "low" ? "bg-sky-500" : "bg-slate-400"
                }`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-950 dark:text-white">{finding.title}</span>
                    <StatusBadge tone={severityTone[finding.severity]}>{SEVERITY_LABELS[finding.severity]}</StatusBadge>
                    <StatusBadge tone="neutral">{FINDING_STATUS_LABELS[finding.status]}</StatusBadge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>{finding.project?.name ?? finding.projectId}</span>
                    <span>{finding.affectedTarget}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
