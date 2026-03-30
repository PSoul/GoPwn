import Link from "next/link"
import { notFound } from "next/navigation"

import { ProjectStageFlow } from "@/components/projects/project-stage-flow"
import { ProjectWorkspaceIntro } from "@/components/projects/project-workspace-intro"
import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { getStoredProjectById, getStoredProjectDetailById } from "@/lib/project-repository"

export default async function ProjectFlowPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = await getStoredProjectById(projectId)
  const detail = await getStoredProjectDetailById(projectId)

  if (!project || !detail) {
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
      <ProjectWorkspaceIntro
        title="阶段流转详情"
        description="阶段流转被下沉到二级页，只在需要排查主路径、回流补采和阻塞原因时再展开查看。"
        actions={
          <>
            <StatusBadge tone={statusTone}>
              {project.stage}
            </StatusBadge>
            <Button asChild variant="outline" className="rounded-full px-5">
              <Link href={`/projects/${project.id}`}>返回项目详情</Link>
            </Button>
          </>
        }
      />

      <SectionCard title="当前阶段摘要" description={detail.target}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">当前阶段</p>
            <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">{detail.currentStage.title}</p>
          </div>
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">阶段负责人</p>
            <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">{detail.currentStage.owner}</p>
          </div>
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">最近更新</p>
            <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">{detail.currentStage.updatedAt}</p>
          </div>
        </div>
      </SectionCard>

      <ProjectStageFlow detail={detail} />
    </div>
  )
}
