import { notFound } from "next/navigation"

import { ProjectForm } from "@/components/projects/project-form"
import { PageHeader } from "@/components/shared/page-header"
import { getStoredProjectById, getStoredProjectFormPreset } from "@/lib/project-repository"
import type { ProjectFormPreset } from "@/lib/prototype-types"

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = await getStoredProjectById(projectId)

  if (!project) {
    notFound()
  }

  const defaultPreset: ProjectFormPreset = { name: "", targetInput: "", description: "" }
  const preset = projectId ? (await getStoredProjectFormPreset(projectId) ?? defaultPreset) : defaultPreset

  return (
    <div className="space-y-5">
      <PageHeader
        title={`编辑项目 · ${project.name}`}
        description="项目编辑页与新建页共享同一套最小表单结构，会直接预填当前项目的项目名称、目标和项目说明。"
      />

      <ProjectForm mode="edit" project={project} preset={preset} />
    </div>
  )
}
