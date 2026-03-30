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
  const project = await getProjectRecord(projectId)

  if (!project) {
    notFound()
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={`编辑项目 · ${project.name}`}
        description="项目编辑页与新建页共享同一套最小表单结构，会直接预填当前项目的项目名称、目标和项目说明。"
      />

      <ProjectForm mode="edit" project={project} preset={await getProjectFormPresetValue(project.id)} />
    </div>
  )
}
