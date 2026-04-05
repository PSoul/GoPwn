import { notFound } from "next/navigation"
import { requireAuth } from "@/lib/infra/auth"
import * as assetRepo from "@/lib/repositories/asset-repo"
import * as findingRepo from "@/lib/repositories/finding-repo"
import { IpDetail } from "@/components/projects/ip-detail"

export default async function IpDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; assetId: string }>
}) {
  await requireAuth()
  const { projectId, assetId } = await params

  const ipAsset = await assetRepo.findById(assetId)
  if (!ipAsset || ipAsset.projectId !== projectId || ipAsset.kind !== "ip") {
    notFound()
  }

  // Fetch related data in parallel
  const [ports, webApps, allFindings] = await Promise.all([
    assetRepo.findPortsByIpAsset(assetId),
    assetRepo.findWebAppsByIpAsset(assetId),
    findingRepo.findByProject(projectId),
  ])

  // Filter findings that affect this IP
  const relatedFindings = allFindings.filter((f) =>
    f.affectedTarget.includes(ipAsset.value),
  )

  // Find associated domain (parent of this IP, if any)
  const associatedDomain =
    ipAsset.parent?.kind === "domain" || ipAsset.parent?.kind === "subdomain"
      ? ipAsset.parent
      : null

  return (
    <IpDetail
      projectId={projectId}
      ipAsset={ipAsset}
      associatedDomain={associatedDomain}
      ports={ports}
      relatedFindings={relatedFindings}
      webApps={webApps}
    />
  )
}
