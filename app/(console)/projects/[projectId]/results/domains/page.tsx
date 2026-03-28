import Link from "next/link"
import { notFound } from "next/navigation"

import { ProjectInventoryTable } from "@/components/projects/project-inventory-table"
import { ProjectWorkspaceIntro } from "@/components/projects/project-workspace-intro"
import { SectionCard } from "@/components/shared/section-card"
import { Button } from "@/components/ui/button"
import { getProjectInventoryPayload } from "@/lib/prototype-api"

export default async function ProjectDomainsResultsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const payload = getProjectInventoryPayload(projectId, "域名 / Web 入口")

  if (!payload) {
    notFound()
  }

  const { group, project } = payload

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
        <ProjectInventoryTable group={group} />
      </SectionCard>
    </div>
  )
}
