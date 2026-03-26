import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { projectTasks } from "@/lib/prototype-data"

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

export function ProjectTaskBoard() {
  return (
    <SectionCard title="当前阶段待办" eyebrow="Action Queue" description="把关键任务、审批阻塞、依赖阻塞和失败待处理分开放到一个可扫读面板中。">
      <div className="grid gap-4 lg:grid-cols-3">
        {projectTasks.map((task) => (
          <div key={task.id} className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-950 dark:text-white">{task.title}</p>
              <StatusBadge tone={taskTone[task.status]}>{task.priority}</StatusBadge>
            </div>
            <div className="mb-3">
              <StatusBadge tone={taskTone[task.status]}>{task.status}</StatusBadge>
            </div>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{task.reason}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
