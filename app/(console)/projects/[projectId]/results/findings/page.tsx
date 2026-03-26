import Link from "next/link"
import { notFound } from "next/navigation"

import { ProjectFindingsTable } from "@/components/projects/project-findings-table"
import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { Button } from "@/components/ui/button"
import { getProjectFindingsPayload } from "@/lib/prototype-api"

export default async function ProjectFindingsResultsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const payload = getProjectFindingsPayload(projectId)

  if (!payload) {
    notFound()
  }

  const { findings, project } = payload

  return (
    <div className="space-y-5">
      <PageHeader
        title="漏洞与发现"
        description="问题列表独立成整页表格，适合后续承载已确认问题、待验证候选和待复核 finding。"
        actions={
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href={`/projects/${project.id}`}>返回项目详情</Link>
          </Button>
        }
      />

      <SectionCard title={project.name} description="问题结果按表格呈现，方便后续扩展排序、筛选和批量处理。">
        <ProjectFindingsTable findings={findings} />
      </SectionCard>
    </div>
  )
}
