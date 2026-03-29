import { notFound } from "next/navigation"

import { ProjectMcpRunsPanel } from "@/components/projects/project-mcp-runs-panel"
import { ProjectOrchestratorPanel } from "@/components/projects/project-orchestrator-panel"
import { ProjectOperationsPanel } from "@/components/projects/project-operations-panel"
import { ProjectReportExportPanel } from "@/components/projects/project-report-export-panel"
import { ProjectSchedulerRuntimePanel } from "@/components/projects/project-scheduler-runtime-panel"
import { mcpCapabilityRecords } from "@/lib/platform-config"
import { getProjectOperationsPayload } from "@/lib/prototype-api"
import { getProjectPrimaryTarget } from "@/lib/project-targets"

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
  const projectReadOnlyReason =
    project.status === "已完成"
      ? "当前项目已完成，如需继续测试请新建项目。"
      : project.status === "已停止"
        ? "当前项目已停止。"
        : undefined

  return (
    <div className="space-y-4">
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
      <ProjectOrchestratorPanel
        projectId={project.id}
        initialPayload={orchestrator}
        readOnlyReason={projectReadOnlyReason}
      />

      <ProjectMcpRunsPanel
        projectId={project.id}
        defaultTarget={getProjectPrimaryTarget(project)}
        capabilities={mcpCapabilityRecords.map((item) => item.name)}
        initialRuns={mcpRuns}
        readOnlyReason={projectReadOnlyReason}
      />
    </div>
  )
}
