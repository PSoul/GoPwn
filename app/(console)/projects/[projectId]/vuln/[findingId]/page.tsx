import { notFound } from "next/navigation"

import { FindingDetail } from "@/components/projects/finding-detail"
import * as findingRepo from "@/lib/repositories/finding-repo"

export default async function FindingDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; findingId: string }>
}) {
  const { projectId, findingId } = await params
  const finding = await findingRepo.findById(findingId)

  if (!finding || finding.projectId !== projectId) {
    notFound()
  }

  // findById already includes pocs, asset, evidence
  const poc = finding.pocs?.[0] ?? null
  const evidence = finding.evidence ?? null

  return <FindingDetail finding={finding} projectId={projectId} poc={poc} evidence={evidence} />
}
