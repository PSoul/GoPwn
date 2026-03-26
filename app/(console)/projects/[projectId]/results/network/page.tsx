import Link from "next/link"
import { notFound } from "next/navigation"

import { ProjectInventoryTable } from "@/components/projects/project-inventory-table"
import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { Button } from "@/components/ui/button"
import { getProjectAssetGroup, getProjectById } from "@/lib/prototype-data"

export default async function ProjectNetworkResultsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = getProjectById(projectId)
  const group = getProjectAssetGroup(projectId, "IP / 端口 / 服务")

  if (!project || !group) {
    notFound()
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="IP / 端口 / 服务"
        description="网络面结果独立成整页表格，后续出现大量开放端口和服务画像时依然能稳定承载。"
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
