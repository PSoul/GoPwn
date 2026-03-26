import Link from "next/link"
import { Plus } from "lucide-react"

import { ProjectListClient } from "@/components/projects/project-list-client"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { projects } from "@/lib/prototype-data"

export default function ProjectsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="项目管理"
        description="项目列表现在承担前端原型版 CRUD 入口：搜索、筛选、查看详情、编辑和关闭动作都从这里进入。"
        actions={
          <Button asChild className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200">
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              新建项目
            </Link>
          </Button>
        }
      />

      <ProjectListClient projects={projects} />
    </div>
  )
}
