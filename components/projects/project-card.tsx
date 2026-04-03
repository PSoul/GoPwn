"use client"

import Link from "next/link"
import { ArchiveX, ExternalLink, Pencil } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { getProjectPrimaryTarget } from "@/lib/project/project-targets"
import type { ProjectRecord } from "@/lib/prototype-types"

const statusConfig = {
  运行中: { border: "border-l-sky-500", tone: "info" as const, pulse: true },
  待启动: { border: "border-l-slate-400", tone: "warning" as const, pulse: false },
  已完成: { border: "border-l-emerald-500", tone: "success" as const, pulse: false },
  等待审批: { border: "border-l-rose-500", tone: "danger" as const, pulse: false },
  已暂停: { border: "border-l-amber-500", tone: "warning" as const, pulse: false },
  已停止: { border: "border-l-slate-400", tone: "neutral" as const, pulse: false },
} as const

export function ProjectCard({
  project,
  onArchive,
}: {
  project: ProjectRecord
  onArchive?: (project: ProjectRecord) => void
}) {
  const config = statusConfig[project.status] ?? statusConfig["待启动"]

  return (
    <div
      className={`group relative rounded-2xl border border-l-4 ${config.border} border-slate-200/80 bg-white p-5 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-950/70`}
    >
      {/* Header: Status + Code */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge tone={config.tone}>
            {config.pulse && (
              <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
            )}
            {project.status}
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

      {/* Target */}
      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
        {getProjectPrimaryTarget(project)}
        {project.targets.length > 1 && (
          <span className="ml-1 text-xs text-slate-400">+{project.targets.length - 1} 个目标</span>
        )}
      </p>

      {/* Summary */}
      {project.summary && (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {project.summary}
        </p>
      )}

      {/* Metrics Row */}
      <div className="mt-4 flex flex-wrap gap-2">
        {project.assetCount > 0 && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {project.assetCount} 资产
          </span>
        )}
        {project.evidenceCount > 0 && (
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-950/50 dark:text-sky-400">
            {project.evidenceCount} 证据
          </span>
        )}
        {project.pendingApprovals > 0 && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
            {project.pendingApprovals} 待审批
          </span>
        )}
        {project.openTasks > 0 && (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">
            {project.openTasks} 任务
          </span>
        )}
      </div>

      {/* Stage + Activity */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{project.stage}</span>
        <span>{project.lastUpdated}</span>
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
        {onArchive && (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            onClick={() => onArchive(project)}
          >
            <ArchiveX className="mr-1 h-3 w-3" />
            归档
          </Button>
        )}
      </div>
    </div>
  )
}
