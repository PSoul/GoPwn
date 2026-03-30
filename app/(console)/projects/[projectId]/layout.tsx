import Link from "next/link"
import { notFound } from "next/navigation"

import { ProjectWorkspaceNav } from "@/components/projects/project-workspace-nav"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { getProjectRecord } from "@/lib/prototype-api"

export default async function ProjectWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = await getProjectRecord(projectId)

  if (!project) {
    notFound()
  }

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
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-slate-950 dark:text-white">{project.name}</h1>
            <StatusBadge tone={statusTone}>{project.status}</StatusBadge>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span>资产 <strong className="text-slate-950 dark:text-white">{project.assetCount}</strong></span>
              <span>证据 <strong className="text-slate-950 dark:text-white">{project.evidenceCount}</strong></span>
              <span>审批 <strong className="text-slate-950 dark:text-white">{project.pendingApprovals}</strong></span>
            </div>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href={`/projects/${project.id}/edit`}>编辑</Link>
            </Button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {project.targets.length > 0 ? (
            project.targets.map((target) => (
              <span
                key={target}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300"
              >
                {target}
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
