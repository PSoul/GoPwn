import Link from "next/link"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { getProjectPrimaryTarget, SINGLE_USER_LABEL } from "@/lib/project-targets"
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
  const statusTone =
    project.status === "已阻塞"
      ? "danger"
      : project.status === "已完成"
        ? "success"
        : project.status === "已停止"
          ? "neutral"
          : project.status === "已暂停" || project.status === "待处理"
            ? "warning"
            : "info"

  return (
    <SectionCard title="项目概览" description="项目工作台首屏只保留结果、当前阶段、执行状态和最近更新；项目名称与目标固定展示在上方工作区头部。">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">项目说明</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {project.description || "当前项目还没有补充说明。"}
                </p>
              </div>
              <StatusBadge tone={statusTone}>
                {project.status}
              </StatusBadge>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="text-xs text-slate-500 dark:text-slate-400">首要目标</p>
                <p className="mt-2 text-sm font-medium text-slate-950 dark:text-white">{getProjectPrimaryTarget(project) || "等待录入"}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {project.targets.length} 个目标已录入{project.status === "待处理" ? "，等待手动开始" : "并进入项目编排输入"}
                </p>
              </div>
              <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="text-xs text-slate-500 dark:text-slate-400">最近更新时间</p>
                <p className="mt-2 text-sm font-medium text-slate-950 dark:text-white">{project.lastUpdated}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{project.lastActor}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {detail.resultMetrics.map((metric) => (
              <div key={metric.label} className={cn("rounded-[24px] border p-4", metricToneStyles[metric.tone])}>
                <p className="text-xs text-slate-500 dark:text-slate-400">{metric.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{metric.value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{metric.note}</p>
              </div>
            ))}
          </div>

          {detail.finalConclusion ? (
            <div className="rounded-[24px] border border-emerald-200/80 bg-emerald-50/80 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">最终结论</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{detail.finalConclusion.summary}</p>
                </div>
                <StatusBadge tone={detail.finalConclusion.source === "reviewer" ? "success" : "info"}>
                  {detail.finalConclusion.source === "reviewer" ? "LLM 审阅" : "本地回退"}
                </StatusBadge>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[20px] border border-emerald-200/80 bg-white/80 p-4 dark:border-emerald-900/60 dark:bg-slate-950/50">
                  <p className="text-xs text-slate-500 dark:text-slate-400">结论锚点</p>
                  <div className="mt-2 space-y-1 text-sm leading-6 text-slate-700 dark:text-slate-200">
                    {detail.finalConclusion.keyPoints.map((point) => (
                      <p key={point}>{point}</p>
                    ))}
                  </div>
                </div>
                <div className="rounded-[20px] border border-emerald-200/80 bg-white/80 p-4 dark:border-emerald-900/60 dark:bg-slate-950/50">
                  <p className="text-xs text-slate-500 dark:text-slate-400">后续建议</p>
                  <div className="mt-2 space-y-1 text-sm leading-6 text-slate-700 dark:text-slate-200">
                    {detail.finalConclusion.nextActions.map((action) => (
                      <p key={action}>{action}</p>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{detail.finalConclusion.generatedAt}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950 dark:text-white">最近结果更新</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{detail.currentFocus}</p>
              </div>
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link href={`/projects/${project.id}/context`}>查看证据与日志</Link>
              </Button>
            </div>

            <div className="mt-4 space-y-2.5">
              {detail.activity.slice(0, 5).map((item) => (
                <div
                  key={`${item.title}-${item.meta}`}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/80 px-3 py-3 dark:border-slate-800"
                >
                  <div className="space-y-1">
                <p className="text-sm font-medium text-slate-950 dark:text-white">{item.title}</p>
                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{item.detail}</p>
                  </div>
                  <StatusBadge tone={item.tone}>{item.meta}</StatusBadge>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-sky-200/80 bg-sky-50/80 p-4 dark:border-sky-900/60 dark:bg-sky-950/30">
            <p className="text-xs text-slate-500 dark:text-slate-400">当前阶段</p>
            <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{detail.currentStage.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{detail.currentStage.summary}</p>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{detail.currentStage.updatedAt}</p>
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
              审批 / 开放任务，生命周期动作在任务与调度页手动控制，具体并发和审批由 MCP 与系统设置统一控制。
            </p>
            <Button asChild size="sm" className="mt-3 w-full rounded-full bg-slate-950 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200">
              <Link href={`/projects/${project.id}/operations`}>查看任务与调度详情</Link>
            </Button>
          </div>

          <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-950 dark:text-white">项目收束状态</p>
              <StatusBadge tone={detail.closureStatus.tone}>{detail.closureStatus.label}</StatusBadge>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p>{detail.closureStatus.summary}</p>
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone={detail.closureStatus.reportExported ? "success" : "neutral"}>
                  报告{detail.closureStatus.reportExported ? "已导出" : "待导出"}
                </StatusBadge>
                <StatusBadge tone={detail.closureStatus.finalConclusionGenerated ? "success" : "neutral"}>
                  结论{detail.closureStatus.finalConclusionGenerated ? "已生成" : "待生成"}
                </StatusBadge>
              </div>
              {detail.closureStatus.blockers.length > 0 ? (
                <div className="space-y-2 rounded-[20px] border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                  {detail.closureStatus.blockers.map((blocker) => (
                    <div key={`${blocker.title}-${blocker.detail}`}>
                      <p className="font-medium text-slate-950 dark:text-white">{blocker.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{blocker.detail}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>当前没有新的收束阻塞，可以直接围绕现有结果继续复核或导出。</p>
              )}
              <p>阻塞原因：{detail.blockingReason}</p>
              <p>下一步：{detail.nextStep}</p>
              <p>当前操作者：{SINGLE_USER_LABEL}</p>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
