import Link from "next/link"
import { notFound } from "next/navigation"

import { ProjectResultsHub } from "@/components/projects/project-results-hub"
import { ProjectSummary } from "@/components/projects/project-summary"
import { Button } from "@/components/ui/button"
import { getProjectOverviewPayload } from "@/lib/prototype-api"

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const payload = getProjectOverviewPayload(projectId)

  if (!payload) {
    notFound()
  }

  const { project, detail } = payload

  return (
    <div className="space-y-5">
      <ProjectSummary project={project} detail={detail} />
      <ProjectResultsHub project={project} detail={detail} />
      <div className="flex justify-end">
        <Button asChild variant="outline" className="rounded-full px-5">
          <Link href={`/projects/${project.id}/context`}>查看完整证据与日志</Link>
        </Button>
      </div>
    </div>
  )
}
