import { notFound } from "next/navigation"

import { ProjectLlmLogPanel } from "@/components/projects/project-llm-log-panel"
import { getStoredProjectById, getStoredProjectDetailById } from "@/lib/project-repository"

export default async function ProjectAiLogsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = await getStoredProjectById(projectId)
  const detail = await getStoredProjectDetailById(projectId)

  if (!project || !detail) {
    notFound()
  }

  const isRunning = project.status === "运行中"

  return <ProjectLlmLogPanel projectId={projectId} isRunning={isRunning} />
}
