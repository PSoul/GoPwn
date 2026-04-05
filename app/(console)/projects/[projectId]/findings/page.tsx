import { notFound } from "next/navigation"

import { FindingsListTable } from "@/components/projects/findings-list-table"
import { requireAuth } from "@/lib/infra/auth"
import { getProject } from "@/lib/services/project-service"
import * as findingRepo from "@/lib/repositories/finding-repo"

export default async function FindingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  await requireAuth()
  const { projectId } = await params

  let project
  try {
    project = await getProject(projectId)
  } catch {
    notFound()
  }

  const findings = await findingRepo.findByProject(projectId)

  return (
    <div className="p-4">
      <FindingsListTable projectId={project.id} findings={findings} />
    </div>
  )
}
