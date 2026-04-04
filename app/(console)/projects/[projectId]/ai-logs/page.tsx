import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangle } from "lucide-react"

import { ProjectLlmLogPanel } from "@/components/projects/project-llm-log-panel"
import { requireAuth } from "@/lib/infra/auth"
import { getProject } from "@/lib/services/project-service"
import { getLlmProfiles } from "@/lib/services/settings-service"

export default async function ProjectAiLogsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  await requireAuth()
  const { projectId } = await params

  let project
  try {
    project = await getProject(projectId)
  } catch {
    notFound()
  }

  const isRunning = project.lifecycle === "executing" || project.lifecycle === "planning"
  const llmProfiles = await getLlmProfiles()
  const orchestratorProfile = llmProfiles.find((p) => p.id === "orchestrator")
  const llmNotConfigured = !orchestratorProfile?.model

  return (
    <div className="space-y-4">
      {llmNotConfigured && (
        <div className="flex items-start gap-3 rounded-card border border-amber-200/80 bg-amber-50/80 px-5 py-4 dark:border-amber-900/60 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">主规划模型未启用</p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              AI 日志需要 AI 规划器正常工作才能生成。请先
              <Link href="/settings/llm" className="mx-0.5 font-medium underline hover:text-amber-900 dark:hover:text-amber-100">前往 LLM 设置</Link>
              配置并启用模型。
            </p>
          </div>
        </div>
      )}
      <ProjectLlmLogPanel projectId={projectId} isRunning={isRunning} />
    </div>
  )
}
