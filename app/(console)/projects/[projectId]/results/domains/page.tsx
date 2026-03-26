import Link from "next/link"
import { notFound } from "next/navigation"

import { ProjectInventoryTable } from "@/components/projects/project-inventory-table"
import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { Button } from "@/components/ui/button"
import { getProjectAssetGroup, getProjectById } from "@/lib/prototype-data"

export default async function ProjectDomainsResultsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = getProjectById(projectId)
  const group = getProjectAssetGroup(projectId, "域名 / Web 入口")

  if (!project || !group) {
    notFound()
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="域名 / Web 入口"
        description="域名、后台入口、路径入口等 Web 面资产单独成页，后续即使数量变多也不会挤乱项目总览。"
        actions={
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href={`/projects/${project.id}`}>返回项目详情</Link>
          </Button>
        }
      />

      <SectionCard title={project.name} description={group.description}>
        <ProjectInventoryTable group={group} />
      </SectionCard>
    </div>
  )
}
