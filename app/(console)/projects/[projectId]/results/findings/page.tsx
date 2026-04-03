import Link from "next/link"
import { notFound } from "next/navigation"

import { ProjectFindingsTable } from "@/components/projects/project-findings-table"
import { ProjectWorkspaceIntro } from "@/components/projects/project-workspace-intro"
import { SectionCard } from "@/components/shared/section-card"
import { Button } from "@/components/ui/button"
import { getStoredProjectById } from "@/lib/project/project-repository"
import { listStoredProjectFindings } from "@/lib/project/project-results-repository"

export default async function ProjectFindingsResultsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = await getStoredProjectById(projectId)

  if (!project) {
    notFound()
  }

  const findings = await listStoredProjectFindings(projectId)

  return (
    <div className="space-y-5">
      <ProjectWorkspaceIntro
        title="漏洞与发现"
        description="问题列表独立成整页表格，适合后续承载已确认问题、待验证候选和待复核 finding。"
        actions={
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href={`/projects/${project.id}`}>返回项目详情</Link>
          </Button>
        }
      />

      <SectionCard title="结果表" description="问题结果按表格呈现，方便后续扩展排序、筛选和批量处理。">
        <ProjectFindingsTable findings={findings} projectId={project.id} />
      </SectionCard>
    </div>
  )
}
