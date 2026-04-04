import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangle } from "lucide-react"

import { ProjectMcpRunsPanel } from "@/components/projects/project-mcp-runs-panel"
import { ProjectOperationsPanel } from "@/components/projects/project-operations-panel"
import { requireAuth } from "@/lib/infra/auth"
import { getProject } from "@/lib/services/project-service"
import { listByProject as listApprovals } from "@/lib/services/approval-service"
import { getLlmProfiles, getGlobalConfig } from "@/lib/services/settings-service"
import * as mcpRunRepo from "@/lib/repositories/mcp-run-repo"

export default async function ProjectOperationsPage({
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

  const [mcpRuns, approvals, llmProfiles, globalConfig] = await Promise.all([
    mcpRunRepo.findByProject(projectId),
    listApprovals(projectId),
    getLlmProfiles(),
    getGlobalConfig(),
  ])

  const orchestratorProfile = llmProfiles.find((p) => p.id === "orchestrator")
  const llmNotConfigured = !orchestratorProfile?.model

  const readOnlyReason =
    project.lifecycle === "completed" ? "当前项目已完成，如需继续测试请新建项目。"
    : project.lifecycle === "stopped" ? "当前项目已停止。"
    : undefined

  const defaultTarget = project.targets?.[0]?.value ?? ""

  return (
    <div className="space-y-4">
      {llmNotConfigured && (
        <div className="flex items-start gap-3 rounded-card border border-amber-200/80 bg-amber-50/80 px-5 py-4 dark:border-amber-900/60 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">主规划模型未配置</p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              AI 规划器未配置模型，请先
              <Link href="/settings/llm" className="mx-0.5 font-medium underline hover:text-amber-900 dark:hover:text-amber-100">配置 LLM 模型</Link>
              以获得完整的智能规划能力。
            </p>
          </div>
        </div>
      )}

      <ProjectOperationsPanel
        project={project}
        approvals={approvals}
        globalConfig={globalConfig ?? undefined}
      />

      <ProjectMcpRunsPanel
        projectId={project.id}
        defaultTarget={defaultTarget}
        initialRuns={mcpRuns}
        readOnlyReason={readOnlyReason}
      />
    </div>
  )
}
