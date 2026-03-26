import { PageHeader } from "@/components/shared/page-header"
import { ProjectKnowledgeTabs } from "@/components/projects/project-knowledge-tabs"
import { ProjectStageFlow } from "@/components/projects/project-stage-flow"
import { ProjectSummary } from "@/components/projects/project-summary"
import { ProjectTaskBoard } from "@/components/projects/project-task-board"
import { StatusBadge } from "@/components/shared/status-badge"

export default function ProjectDetailPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="项目详情"
        description="项目详情页不是普通 tab 列表，而是围绕阶段推进、阻塞说明、回流提示和沉淀结果组织的流程指挥台。"
        actions={<StatusBadge tone="danger">2 个待审批动作</StatusBadge>}
      />
      <ProjectSummary />
      <ProjectStageFlow />
      <ProjectTaskBoard />
      <ProjectKnowledgeTabs />
    </div>
  )
}
