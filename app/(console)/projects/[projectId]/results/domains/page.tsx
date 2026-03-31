import Link from "next/link"
import { notFound } from "next/navigation"
import { Globe } from "lucide-react"

import { ProjectInventoryTable } from "@/components/projects/project-inventory-table"
import { ProjectWorkspaceIntro } from "@/components/projects/project-workspace-intro"
import { SectionCard } from "@/components/shared/section-card"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { getStoredProjectById, getStoredProjectDetailById } from "@/lib/project-repository"

export default async function ProjectDomainsResultsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = await getStoredProjectById(projectId)
  const detail = await getStoredProjectDetailById(projectId)
  const group = detail?.assetGroups.find((item) => item.title === "域名 / Web 入口")

  if (!project || !group || !detail) {
    notFound()
  }

  return (
    <div className="space-y-5">
      <ProjectWorkspaceIntro
        title="域名 / Web 入口"
        description="域名、后台入口、路径入口等 Web 面资产单独成页，后续即使数量变多也不会挤乱项目总览。"
        actions={
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href={`/projects/${project.id}`}>返回项目详情</Link>
          </Button>
        }
      />

      <SectionCard title="结果表" description={group.description}>
        {group.items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <Globe className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </EmptyMedia>
              <EmptyTitle>暂无域名 / Web 入口</EmptyTitle>
              <EmptyDescription>项目执行后，发现的域名和 Web 入口会出现在这里。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ProjectInventoryTable group={group} />
        )}
      </SectionCard>
    </div>
  )
}
