import { ProjectForm } from "@/components/projects/project-form"
import { PageHeader } from "@/components/shared/page-header"
import type { ProjectFormPreset } from "@/lib/prototype-types"

export default async function NewProjectPage() {
  const preset: ProjectFormPreset = { name: "", targetInput: "", description: "" }

  return (
    <div className="space-y-5">
      <PageHeader
        title="新建项目"
        description="项目创建现在只保留项目名称、目标和项目说明三项最小输入，保存后直接进入项目工作台。"
      />

      <ProjectForm mode="create" preset={preset} />
    </div>
  )
}
