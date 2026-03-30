import { notFound } from "next/navigation"

import { ProjectResultsHub } from "@/components/projects/project-results-hub"
import { ProjectSummary } from "@/components/projects/project-summary"
import { getProjectOverviewPayload } from "@/lib/prototype-api"

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const payload = await getProjectOverviewPayload(projectId)

  if (!payload) {
    notFound()
  }

  const { project, detail } = payload

  return (
    <div className="space-y-4">
      <ProjectSummary project={project} detail={detail} />
      <ProjectResultsHub project={project} detail={detail} />
    </div>
  )
}
