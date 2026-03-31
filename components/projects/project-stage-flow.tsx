import { ArrowRight, GitBranch } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import type { ProjectDetailRecord } from "@/lib/prototype-types"

const toneMap = {
  done: "success",
  current: "info",
  blocked: "danger",
  watching: "warning",
} as const

export function ProjectStageFlow({ detail }: { detail: ProjectDetailRecord }) {
  return (
    <SectionCard title="阶段流转" description="主阶段保持稳定，允许前置阶段在发现新对象时继续采集，不会重置整个项目。">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-3">
          {detail.timeline.map((stage, index) => (
            <div key={stage.title} className="grid gap-3 md:grid-cols-[auto_1fr_auto] md:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                  {index + 1}
                </div>
                {index < detail.timeline.length - 1 ? <ArrowRight className="hidden h-4 w-4 text-slate-400 md:block" /> : null}
              </div>
              <div className="rounded-item border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-950 dark:text-white">{stage.title}</p>
                  <StatusBadge tone={toneMap[stage.state]}>{stage.state}</StatusBadge>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">{stage.note}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="rounded-item border border-rose-200 bg-rose-50/80 p-5 dark:border-rose-900/80 dark:bg-rose-950/40">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-200">当前阻塞</p>
            <p className="mt-2 text-sm leading-6 text-rose-800/90 dark:text-rose-100/90">{detail.blockingReason}</p>
          </div>

          <div className="rounded-item border border-sky-200 bg-sky-50/80 p-5 dark:border-sky-900/80 dark:bg-sky-950/40">
            <p className="text-sm font-semibold text-sky-700 dark:text-sky-200">下一步建议</p>
            <p className="mt-2 text-sm leading-6 text-sky-800/90 dark:text-sky-100/90">{detail.nextStep}</p>
          </div>

          <div className="rounded-item border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900/80 dark:bg-amber-950/40">
            <div className="mb-2 flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-amber-700 dark:text-amber-200" />
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-200">阶段提示</p>
            </div>
            <p className="text-sm leading-6 text-amber-800/90 dark:text-amber-100/90">{detail.reflowNotice}</p>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
