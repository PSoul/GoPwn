import Link from "next/link"
import { notFound } from "next/navigation"

import { ProjectWorkspaceNav } from "@/components/projects/project-workspace-nav"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import * as projectService from "@/lib/services/project-service"
import { LIFECYCLE_LABELS, PHASE_LABELS } from "@/lib/types/labels"

function lifecycleTone(lifecycle: string): "danger" | "success" | "neutral" | "warning" | "info" {
  if (lifecycle === "waiting_approval" || lifecycle === "failed") return "danger"
  if (lifecycle === "completed") return "success"
  if (lifecycle === "stopped" || lifecycle === "idle") return "neutral"
  if (lifecycle === "stopping" || lifecycle === "settling") return "warning"
  return "info"
}

export default async function ProjectWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params

  let project
  try {
    project = await projectService.getProject(projectId)
  } catch {
    notFound()
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-slate-950 dark:text-white">{project.name}</h1>
            <StatusBadge tone={lifecycleTone(project.lifecycle)}>
              {LIFECYCLE_LABELS[project.lifecycle]}
            </StatusBadge>
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs text-sky-700 dark:bg-sky-950 dark:text-sky-300">
              {PHASE_LABELS[project.currentPhase]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span>轮次 <strong className="text-slate-950 dark:text-white">{project.currentRound}/{project.maxRounds}</strong></span>
            </div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {project.targets.length > 0 ? (
            project.targets.map((target) => (
              <span
                key={target.id}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300"
              >
                [{target.type}] {target.value}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400">等待目标输入</span>
          )}
        </div>
      </section>

      <ProjectWorkspaceNav projectId={project.id} />
      {children}
    </div>
  )
}
