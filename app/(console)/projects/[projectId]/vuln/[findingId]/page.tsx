import { notFound } from "next/navigation"

import { FindingDetail } from "@/components/projects/finding-detail"
import { requireAuth } from "@/lib/infra/auth"
import * as findingRepo from "@/lib/repositories/finding-repo"

export default async function FindingDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; findingId: string }>
}) {
  await requireAuth()
  const { projectId, findingId } = await params
  const finding = await findingRepo.findById(findingId)

  if (!finding || finding.projectId !== projectId) {
    notFound()
  }

  const poc = finding.pocs?.[0] ?? null

  return <FindingDetail finding={finding} projectId={projectId} poc={poc} />
}
