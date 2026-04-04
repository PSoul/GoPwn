import { notFound } from "next/navigation"

import { FindingDetail } from "@/components/projects/finding-detail"
import { getStoredFindingById } from "@/lib/results/project-results-core"

export default async function FindingDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; findingId: string }>
}) {
  const { projectId, findingId } = await params
  const finding = await getStoredFindingById(findingId)

  if (!finding || finding.projectId !== projectId) {
    notFound()
  }

  return <FindingDetail finding={finding} projectId={projectId} />
}
