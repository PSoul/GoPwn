import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangle } from "lucide-react"

import { OperationsCollapsibleSection } from "@/components/projects/operations-collapsible-section"
import { ProjectMcpRunsPanel } from "@/components/projects/project-mcp-runs-panel"
import { ProjectOrchestratorPanel } from "@/components/projects/project-orchestrator-panel"
import { ProjectOperationsPanel } from "@/components/projects/project-operations-panel"
import { ProjectReportExportPanel } from "@/components/projects/project-report-export-panel"
import { ProjectSchedulerRuntimePanel } from "@/components/projects/project-scheduler-runtime-panel"
import { mcpCapabilityRecords } from "@/lib/settings/platform-config"
import { getProjectOperationsPayload } from "@/lib/infra/api-compositions"
import { getProjectPrimaryTarget } from "@/lib/project/project-targets"
import { listStoredLlmProfiles } from "@/lib/llm/llm-settings-repository"

export default async function ProjectOperationsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const payload = await getProjectOperationsPayload(projectId)

  if (!payload) {
    notFound()
  }
  const { approvals, detail, mcpRuns, orchestrator, orchestratorRounds, project, reportExport, schedulerControl, schedulerTasks } = payload

  // Check LLM configuration status
  const llmProfiles = await listStoredLlmProfiles()
  const orchestratorProfile = llmProfiles.find((p) => p.id === "orchestrator")
  const llmNotConfigured = !orchestratorProfile?.enabled || !orchestratorProfile?.model

  const projectReadOnlyReason =
    project.status === "已完成"
      ? "当前项目已完成，如需继续测试请新建项目。"
      : project.status === "已停止"
        ? "当前项目已停止。"
        : undefined

  return (
    <div className="space-y-4">
      {llmNotConfigured && (
        <div className="flex items-start gap-3 rounded-card border border-amber-200/80 bg-amber-50/80 px-5 py-4 dark:border-amber-900/60 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">主规划模型未配置</p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              AI 规划器未启用或未配置模型，项目将使用有限的回退策略（无 AI 日志）。请先
              <Link href="/settings/llm" className="mx-0.5 font-medium underline hover:text-amber-900 dark:hover:text-amber-100">配置 LLM 模型</Link>
              以获得完整的智能规划能力。
            </p>
          </div>
        </div>
      )}

      {/* Primary: lifecycle controls + round progress + task queue */}
      <ProjectSchedulerRuntimePanel
        projectId={project.id}
        projectStatus={project.status}
        closureStatus={detail.closureStatus}
        initialControl={schedulerControl}
        initialTasks={schedulerTasks}
        initialRounds={orchestratorRounds}
      />

      {/* Secondary sections — simpler grid */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ProjectOperationsPanel project={project} detail={detail} approvals={approvals} />
        <ProjectReportExportPanel projectId={project.id} initialPayload={reportExport} />
      </div>

      {/* Advanced sections — for power users */}
      <OperationsCollapsibleSection title="AI 规划配置" defaultOpen={false}>
        <ProjectOrchestratorPanel
          projectId={project.id}
          initialPayload={orchestrator}
          readOnlyReason={projectReadOnlyReason}
        />
      </OperationsCollapsibleSection>

      <OperationsCollapsibleSection title="MCP 调度记录" defaultOpen={false}>
        <ProjectMcpRunsPanel
          projectId={project.id}
          defaultTarget={getProjectPrimaryTarget(project)}
          capabilities={mcpCapabilityRecords.map((item) => item.name)}
          initialRuns={mcpRuns}
          readOnlyReason={projectReadOnlyReason}
        />
      </OperationsCollapsibleSection>
    </div>
  )
}
