import { notFound } from "next/navigation"

import { FindingsListTable } from "@/components/projects/findings-list-table"
import { requireAuth } from "@/lib/infra/auth"
import { getProject } from "@/lib/services/project-service"
import * as findingRepo from "@/lib/repositories/finding-repo"
import type { Severity } from "@/lib/generated/prisma"

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }

export default async function FindingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  await requireAuth()
  const { projectId } = await params

  let project
  try {
    project = await getProject(projectId)
  } catch {
    notFound()
  }

  const rawFindings = await findingRepo.findByProject(projectId)

  // Sort by severity (critical first), then by date
  const findings = rawFindings.sort((a, b) =>
    (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)
    || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <div className="p-4">
      <FindingsListTable projectId={project.id} findings={findings} />
    </div>
  )
}
