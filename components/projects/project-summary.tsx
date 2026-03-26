import { StatusBadge } from "@/components/shared/status-badge"
import { SectionCard } from "@/components/shared/section-card"
import { projectDetailSummary } from "@/lib/prototype-data"

export function ProjectSummary() {
  return (
    <SectionCard title={projectDetailSummary.name} eyebrow="Project Summary" description={projectDetailSummary.target}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2 rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">当前主阶段</p>
          <p className="text-lg font-semibold text-slate-950 dark:text-white">{projectDetailSummary.currentStage}</p>
        </div>
        <div className="space-y-2 rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">整体状态</p>
          <StatusBadge tone="info" className="text-sm">
            {projectDetailSummary.status}
          </StatusBadge>
        </div>
        <div className="space-y-2 rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">待审批数量</p>
          <p className="text-lg font-semibold text-slate-950 dark:text-white">{projectDetailSummary.pendingApprovals}</p>
        </div>
        <div className="space-y-2 rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">最近更新时间</p>
          <p className="text-lg font-semibold text-slate-950 dark:text-white">{projectDetailSummary.lastUpdated}</p>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">风险摘要</p>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{projectDetailSummary.riskSummary}</p>
      </div>
    </SectionCard>
  )
}
