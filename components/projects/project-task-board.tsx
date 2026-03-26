import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import type { TaskRecord } from "@/lib/prototype-types"

const taskTone = {
  waiting_approval: "danger",
  waiting_dependency: "warning",
  scheduled: "info",
  failed: "danger",
  running: "info",
  succeeded: "success",
  pending: "neutral",
  ready: "info",
  needs_review: "warning",
  cancelled: "neutral",
} as const

export function ProjectTaskBoard({ tasks }: { tasks: TaskRecord[] }) {
  return (
    <SectionCard title="任务与调度" description="把关键任务、审批阻塞、依赖阻塞与待复核动作放在同一个面板里，帮助研究员快速接管。">
      <div className="grid gap-4 xl:grid-cols-3">
        {tasks.map((task) => (
          <div key={task.id} className="rounded-[22px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-950 dark:text-white">{task.title}</p>
              <StatusBadge tone={taskTone[task.status]}>{task.priority}</StatusBadge>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge tone={taskTone[task.status]}>{task.status}</StatusBadge>
              <span className="text-xs text-slate-500 dark:text-slate-400">{task.owner}</span>
            </div>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{task.reason}</p>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{task.updatedAt}</span>
              <span>{task.linkedTarget ?? "项目内任务"}</span>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
