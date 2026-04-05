import { notFound } from "next/navigation"
import { requireAuth } from "@/lib/infra/auth"
import { getProject } from "@/lib/services/project-service"
import { listByProject as listAssets } from "@/lib/services/asset-service"
import { AssetPageTabs } from "@/components/projects/asset-page-tabs"

export default async function AssetPage({ params }: { params: Promise<{ projectId: string }> }) {
  await requireAuth()
  const { projectId } = await params

  let project
  try {
    project = await getProject(projectId)
  } catch {
    notFound()
  }

  const assets = await listAssets(projectId)

  return (
    <div className="p-4">
      <AssetPageTabs projectId={project.id} assets={assets} />
    </div>
  )
}
