import Link from "next/link"
import { notFound } from "next/navigation"

import { ProjectResultsHub } from "@/components/projects/project-results-hub"
import { ProjectSummary } from "@/components/projects/project-summary"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { getProjectOverviewPayload } from "@/lib/prototype-api"

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const payload = getProjectOverviewPayload(projectId)

  if (!payload) {
    notFound()
  }

  const { project, detail } = payload

  return (
    <div className="space-y-5">
      <PageHeader
        title={`项目详情 · ${project.name}`}
        description="项目详情继续收束为结果优先的总览入口：先看资产、服务和漏洞结果，再按需进入阶段流转、任务调度或证据上下文。"
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
      <ProjectResultsHub project={project} detail={detail} />
    </div>
  )
}
