import Link from "next/link"
import { notFound } from "next/navigation"
import { Network } from "lucide-react"

import { ProjectInventoryTable } from "@/components/projects/project-inventory-table"
import { ProjectWorkspaceIntro } from "@/components/projects/project-workspace-intro"
import { SectionCard } from "@/components/shared/section-card"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { getStoredProjectById, getStoredProjectDetailById } from "@/lib/project-repository"

export default async function ProjectNetworkResultsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = await getStoredProjectById(projectId)
  const detail = await getStoredProjectDetailById(projectId)
  const group = detail?.assetGroups.find((item) => item.title === "IP / 端口 / 服务")

  if (!project || !group || !detail) {
    notFound()
  }

  return (
    <div className="space-y-5">
      <ProjectWorkspaceIntro
        title="IP / 端口 / 服务"
        description="网络面结果独立成整页表格，后续出现大量开放端口和服务画像时依然能稳定承载。"
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
                <Network className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </EmptyMedia>
              <EmptyTitle>暂无 IP / 端口 / 服务</EmptyTitle>
              <EmptyDescription>项目执行后，发现的 IP 地址、开放端口和运行服务会出现在这里。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ProjectInventoryTable group={group} />
        )}
      </SectionCard>
    </div>
  )
}
