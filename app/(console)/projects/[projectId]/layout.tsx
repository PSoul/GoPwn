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
  const project = getProjectRecord(projectId)

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
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">项目工作台</p>
            <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">{project.name}</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{project.description}</p>
            <div className="pt-1">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">目标</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {project.targets.length > 0 ? (
                  project.targets.map((target) => (
                    <span
                      key={target}
                      className="rounded-full border border-slate-200/80 bg-slate-50/85 px-3 py-1.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300"
                    >
                      {target}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    等待目标输入
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={statusTone}>
              {project.status}
            </StatusBadge>
            <Button asChild variant="outline" className="rounded-full px-5">
              <Link href={`/projects/${project.id}/edit`}>编辑项目</Link>
            </Button>
            <Button asChild className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200">
              <Link href="/approvals">查看审批</Link>
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">当前阶段</p>
            <p className="mt-2 text-sm font-medium text-slate-950 dark:text-white">{project.stage}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">待审批动作</p>
            <p className="mt-2 text-sm font-medium text-slate-950 dark:text-white">{project.pendingApprovals}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">已发现资产</p>
            <p className="mt-2 text-sm font-medium text-slate-950 dark:text-white">{project.assetCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">最近更新</p>
            <p className="mt-2 text-sm font-medium text-slate-950 dark:text-white">{project.lastUpdated}</p>
          </div>
        </div>
      </section>

      <ProjectWorkspaceNav projectId={project.id} />
      {children}
    </div>
  )
}
