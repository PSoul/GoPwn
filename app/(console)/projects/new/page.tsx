import { ProjectForm } from "@/components/projects/project-form"
import { PageHeader } from "@/components/shared/page-header"
import { getProjectFormPresetValue } from "@/lib/prototype-api"

export default function NewProjectPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="新建项目"
        description="从目标、授权、范围与控制策略建立项目基线，创建后即可进入真正的项目详情指挥台。"
      />

      <ProjectForm mode="create" preset={getProjectFormPresetValue()} />
    </div>
  )
}
