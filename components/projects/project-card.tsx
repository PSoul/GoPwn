"use client"

import Link from "next/link"
import { ExternalLink, Pencil, Trash2 } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { Project, ProjectLifecycle } from "@/lib/generated/prisma"
import { LIFECYCLE_LABELS, PHASE_LABELS } from "@/lib/types/labels"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

const lifecycleTone: Record<ProjectLifecycle, { border: string; tone: Tone; pulse: boolean }> = {
  executing: { border: "border-l-sky-500", tone: "info", pulse: true },
  idle: { border: "border-l-slate-400", tone: "neutral", pulse: false },
  planning: { border: "border-l-sky-300", tone: "info", pulse: true },
  completed: { border: "border-l-emerald-500", tone: "success", pulse: false },
  waiting_approval: { border: "border-l-rose-500", tone: "danger", pulse: false },
  reviewing: { border: "border-l-amber-500", tone: "warning", pulse: false },
  settling: { border: "border-l-emerald-300", tone: "success", pulse: false },
  stopping: { border: "border-l-amber-500", tone: "warning", pulse: true },
  stopped: { border: "border-l-slate-400", tone: "neutral", pulse: false },
  failed: { border: "border-l-rose-500", tone: "danger", pulse: false },
}

export function ProjectCard({
  project,
  onDelete,
}: {
  project: Project
  onDelete?: (project: Project) => void
}) {
  const config = lifecycleTone[project.lifecycle] ?? lifecycleTone.idle

  return (
    <div
      className={`group relative rounded-2xl border border-l-4 ${config.border} border-slate-200/80 bg-white p-5 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-950/70`}
    >
      {/* Header: Lifecycle + Code */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge tone={config.tone}>
            {config.pulse && (
              <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
            )}
            {LIFECYCLE_LABELS[project.lifecycle]}
          </StatusBadge>
          <span className="text-xs text-slate-500 dark:text-slate-400">{project.code}</span>
        </div>
      </div>

      {/* Title */}
      <Link
        href={`/projects/${project.id}`}
        className="mt-3 block text-base font-semibold text-slate-950 hover:text-slate-700 dark:text-white dark:hover:text-slate-200"
      >
        {project.name}
      </Link>

      {/* Description */}
      {project.description && (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {project.description}
        </p>
      )}

      {/* Phase + Round */}
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {PHASE_LABELS[project.currentPhase]}
        </span>
        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-950/50 dark:text-sky-400">
          {project.currentRound}/{project.maxRounds} 轮
        </span>
      </div>

      {/* Phase + Updated */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{PHASE_LABELS[project.currentPhase]}</span>
        <span>{new Date(project.updatedAt).toLocaleDateString("zh-CN")}</span>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <Button asChild size="sm" variant="outline" className="rounded-xl text-xs">
          <Link href={`/projects/${project.id}`}>
            <ExternalLink className="mr-1 h-3 w-3" />
            详情
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="rounded-xl text-xs">
          <Link href={`/projects/${project.id}/edit`}>
            <Pencil className="mr-1 h-3 w-3" />
            编辑
          </Link>
        </Button>
        {onDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            onClick={() => onDelete(project)}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            删除
          </Button>
        )}
      </div>
    </div>
  )
}
