import { notFound } from "next/navigation"

import { ProjectResultsHub } from "@/components/projects/project-results-hub"
import { ProjectSummary } from "@/components/projects/project-summary"
import { listStoredAssets } from "@/lib/asset-repository"
import { getStoredProjectById, getStoredProjectDetailById } from "@/lib/project-repository"

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

  const assets = await listStoredAssets(projectId)

  return (
    <div className="space-y-4">
      <ProjectSummary project={project} detail={detail} />
      <ProjectResultsHub project={project} detail={detail} assets={assets} />
    </div>
  )
}
