import { notFound } from "next/navigation"

import { ProjectForm } from "@/components/projects/project-form"
import { PageHeader } from "@/components/shared/page-header"
import { getProjectFormPresetValue, getProjectRecord } from "@/lib/prototype-api"

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = getProjectRecord(projectId)

  if (!project) {
    notFound()
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={`编辑项目 · ${project.name}`}
        description="项目编辑页与新建页共享同一套表单结构，但会预填当前项目的目标、范围与控制策略。"
      />

      <ProjectForm mode="edit" project={project} preset={getProjectFormPresetValue(project.id)} />
    </div>
  )
}
