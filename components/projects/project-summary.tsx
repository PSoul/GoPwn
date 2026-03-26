import Link from "next/link"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ProjectDetailRecord, ProjectRecord, Tone } from "@/lib/prototype-types"

const metricToneStyles: Record<Tone, string> = {
  neutral: "border-slate-200/80 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60",
  info: "border-sky-200/80 bg-sky-50/80 dark:border-sky-900/60 dark:bg-sky-950/30",
  success: "border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/30",
  warning: "border-amber-200/80 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/30",
  danger: "border-rose-200/80 bg-rose-50/80 dark:border-rose-900/60 dark:bg-rose-950/30",
}

export function ProjectSummary({
  project,
  detail,
}: {
  project: ProjectRecord
  detail: ProjectDetailRecord
}) {
  return (
    <SectionCard title={project.name} description={detail.target}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        {detail.resultMetrics.map((metric) => (
          <div key={metric.label} className={cn("rounded-[24px] border p-4", metricToneStyles[metric.tone])}>
            <p className="text-xs text-slate-500 dark:text-slate-400">{metric.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{metric.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{metric.note}</p>
          </div>
        ))}

        <div className="rounded-[24px] border border-sky-200/80 bg-sky-50/80 p-4 dark:border-sky-900/60 dark:bg-sky-950/30">
          <p className="text-xs text-slate-500 dark:text-slate-400">当前阶段</p>
          <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{detail.currentStage.title}</p>
          <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{detail.currentStage.updatedAt}</p>
          <Button asChild variant="outline" size="sm" className="mt-3 w-full rounded-full">
            <Link href={`/projects/${project.id}/flow`}>查看阶段流转详情</Link>
          </Button>
        </div>

        <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">执行控制</p>
            <StatusBadge tone={detail.approvalControl.enabled ? "warning" : "neutral"}>
              {detail.approvalControl.enabled ? "审批开启" : "审批关闭"}
            </StatusBadge>
          </div>
          <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
            {project.pendingApprovals} / {project.openTasks}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
            审批 / 开放任务，低风险自动放行：{detail.approvalControl.autoApproveLowRisk ? "是" : "否"}
          </p>
          <Button asChild size="sm" className="mt-3 w-full rounded-full bg-slate-950 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200">
            <Link href={`/projects/${project.id}/operations`}>查看任务与调度详情</Link>
          </Button>
        </div>

        <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-xs text-slate-500 dark:text-slate-400">证据与上下文</p>
          <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
            {project.evidenceCount} / {detail.activity.length}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
            证据 / 活动记录，补充情报 {detail.discoveredInfo.length} 条
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3 w-full rounded-full">
            <Link href={`/projects/${project.id}/context`}>查看证据与上下文</Link>
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950 dark:text-white">项目判断</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{project.summary}</p>
            </div>
            <StatusBadge tone={project.status === "已阻塞" ? "danger" : project.status === "已完成" ? "success" : "info"}>
              {project.status}
            </StatusBadge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">当前焦点</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{detail.currentFocus}</p>
            </div>
            <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">风险摘要</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{project.riskSummary}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-sm font-semibold text-slate-950 dark:text-white">策略基线</p>
          <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p>负责人：{project.owner}</p>
            <p>默认并发：{project.defaultConcurrency}</p>
            <p>速率限制：{project.rateLimit}</p>
            <p>审批模式：{project.approvalMode}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <StatusBadge key={tag} tone="neutral">
                {tag}
              </StatusBadge>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{project.lastActor}</p>
        </div>
      </div>
    </SectionCard>
  )
}
