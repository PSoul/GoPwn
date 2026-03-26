import Link from "next/link"
import { notFound } from "next/navigation"

import { ProjectKnowledgeTabs } from "@/components/projects/project-knowledge-tabs"
import { ProjectStageFlow } from "@/components/projects/project-stage-flow"
import { ProjectSummary } from "@/components/projects/project-summary"
import { ProjectTaskBoard } from "@/components/projects/project-task-board"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  getProjectApprovals,
  getProjectAssets,
  getProjectById,
  getProjectDetailById,
  getProjectEvidence,
} from "@/lib/prototype-data"

export default async function ProjectDetailPage({
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
  const assets = getProjectAssets(projectId)
  const evidence = getProjectEvidence(projectId)

  return (
    <div className="space-y-5">
      <PageHeader
        title={`项目详情 · ${project.name}`}
        description="项目详情页现在会根据 projectId 读取真实项目数据，围绕阶段推进、阻塞说明、任务接管和沉淀信息组织。"
        actions={
          <>
            <StatusBadge tone={project.status === "已阻塞" ? "danger" : project.status === "已完成" ? "success" : "info"}>
              {project.status}
            </StatusBadge>
            <Button asChild variant="outline" className="rounded-full px-5">
              <Link href={`/projects/${project.id}/edit`}>编辑项目</Link>
            </Button>
            <Button asChild className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200">
              <Link href="/approvals">查看审批</Link>
            </Button>
          </>
        }
      />

      <ProjectSummary project={project} detail={detail} />
      <ProjectStageFlow detail={detail} />
      <ProjectTaskBoard tasks={detail.tasks} />
      <ProjectKnowledgeTabs detail={detail} approvals={approvals} assets={assets} evidence={evidence} />
    </div>
  )
}
