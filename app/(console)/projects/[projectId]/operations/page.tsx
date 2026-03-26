import Link from "next/link"
import { notFound } from "next/navigation"

import { ProjectOperationsPanel } from "@/components/projects/project-operations-panel"
import { ProjectTaskBoard } from "@/components/projects/project-task-board"
import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { getProjectApprovals, getProjectById, getProjectDetailById } from "@/lib/prototype-data"

export default async function ProjectOperationsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = getProjectById(projectId)
  const detail = getProjectDetailById(projectId)

  if (!project || !detail) {
    notFound()
  }

  const approvals = getProjectApprovals(projectId)

  return (
    <div className="space-y-5">
      <PageHeader
        title="任务与调度详情"
        description="任务、审批和调度被统一收拢到二级页，主页面只保留结果与当前阶段，避免研究视线被流程噪音打断。"
        actions={
          <>
            <StatusBadge tone={project.pendingApprovals > 0 ? "warning" : "success"}>
              待审批 {project.pendingApprovals}
            </StatusBadge>
            <Button asChild variant="outline" className="rounded-full px-5">
              <Link href={`/projects/${project.id}`}>返回项目详情</Link>
            </Button>
          </>
        }
      />

      <ProjectOperationsPanel project={project} detail={detail} approvals={approvals} />

      <ProjectTaskBoard tasks={detail.tasks} />

      <SectionCard title="调度关注点" description="这里保留真正需要人工接管的调度说明，不再强行塞回项目首页。">
        <div className="grid gap-3 xl:grid-cols-3">
          {detail.scheduler.map((item) => (
            <div
              key={item.title}
              className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-950 dark:text-white">{item.title}</p>
                <StatusBadge tone={item.tone}>{item.meta}</StatusBadge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.detail}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
