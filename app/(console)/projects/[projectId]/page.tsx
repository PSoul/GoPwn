import { notFound } from "next/navigation"

import { ProjectLiveDashboard } from "@/components/projects/project-live-dashboard"
import { listStoredAssets } from "@/lib/data/asset-repository"
import { listStoredProjectApprovals } from "@/lib/data/approval-repository"
import { getStoredProjectById, getStoredProjectDetailById } from "@/lib/project/project-repository"
import { listStoredProjectFindings } from "@/lib/project/project-results-repository"

export default async function ProjectDetailPage({
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

  const [assets, findings, approvals] = await Promise.all([
    listStoredAssets(projectId),
    listStoredProjectFindings(projectId),
    listStoredProjectApprovals(projectId),
  ])

  return (
    <ProjectLiveDashboard
      project={project}
      detail={detail}
      initialFindings={findings}
      initialAssets={assets}
      initialApprovals={approvals}
    />
  )
}
