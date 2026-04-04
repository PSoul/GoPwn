import { notFound } from "next/navigation"

import { ProjectLiveDashboard } from "@/components/projects/project-live-dashboard"
import { requireAuth } from "@/lib/infra/auth"
import { getProject } from "@/lib/services/project-service"
import { listByProject as listAssets } from "@/lib/services/asset-service"
import * as findingRepo from "@/lib/repositories/finding-repo"
import { listByProject as listApprovals } from "@/lib/services/approval-service"

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  await requireAuth()
  const { projectId } = await params

  let project
  try {
    project = await getProject(projectId)
  } catch {
    notFound()
  }

  const [assets, findings, approvals] = await Promise.all([
    listAssets(projectId),
    findingRepo.findByProject(projectId),
    listApprovals(projectId),
  ])

  return (
    <ProjectLiveDashboard
      project={project}
      initialFindings={findings}
      initialAssets={assets}
      initialApprovals={approvals}
    />
  )
}
