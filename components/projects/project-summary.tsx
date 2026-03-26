import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import type { ProjectDetailRecord, ProjectRecord } from "@/lib/prototype-types"

export function ProjectSummary({
  project,
  detail,
}: {
  project: ProjectRecord
  detail: ProjectDetailRecord
}) {
  return (
    <SectionCard title={project.name} description={detail.target}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2 rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-xs text-slate-500 dark:text-slate-400">当前主阶段</p>
          <p className="text-lg font-semibold text-slate-950 dark:text-white">{project.stage}</p>
        </div>
        <div className="space-y-2 rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-xs text-slate-500 dark:text-slate-400">整体状态</p>
          <StatusBadge tone={project.status === "已阻塞" ? "danger" : project.status === "已完成" ? "success" : "info"} className="text-sm">
            {project.status}
          </StatusBadge>
        </div>
        <div className="space-y-2 rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-xs text-slate-500 dark:text-slate-400">待审批 / 开放任务</p>
          <p className="text-lg font-semibold text-slate-950 dark:text-white">
            {project.pendingApprovals} / {project.openTasks}
          </p>
        </div>
        <div className="space-y-2 rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-xs text-slate-500 dark:text-slate-400">最近更新时间</p>
          <p className="text-lg font-semibold text-slate-950 dark:text-white">{project.lastUpdated}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className="rounded-[22px] border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">项目摘要</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{project.summary}</p>
          </div>
          <div className="rounded-[22px] border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">当前焦点</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{detail.currentFocus}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[22px] border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">策略基线</p>
            <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p>负责人：{project.owner}</p>
              <p>默认并发：{project.defaultConcurrency}</p>
              <p>速率限制：{project.rateLimit}</p>
              <p>审批模式：{project.approvalMode}</p>
            </div>
          </div>
          <div className="rounded-[22px] border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">标签</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <StatusBadge key={tag} tone="neutral">
                  {tag}
                </StatusBadge>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{project.lastActor}</p>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
