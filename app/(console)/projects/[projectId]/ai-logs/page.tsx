import { notFound } from "next/navigation"

import { ProjectLlmLogPanel } from "@/components/projects/project-llm-log-panel"
import { getProjectOverviewPayload } from "@/lib/prototype-api"

export default async function ProjectAiLogsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const payload = await getProjectOverviewPayload(projectId)

  if (!payload) {
    notFound()
  }

  const isRunning = payload.project.status === "运行中"

  return <ProjectLlmLogPanel projectId={projectId} isRunning={isRunning} />
}
