import Link from "next/link"
import { Plus } from "lucide-react"

import { ProjectListClient } from "@/components/projects/project-list-client"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { listStoredProjects } from "@/lib/project-repository"

export default async function ProjectsPage() {
  const projects = await listStoredProjects()
  const data = { items: projects, total: projects.length }
  const { items } = data

  return (
    <div className="space-y-5">
      <PageHeader
        title="项目管理"
        description="搜索、筛选与管理所有安全评估项目"
        actions={
          <Button asChild className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200">
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              新建项目
            </Link>
          </Button>
        }
      />

      <ProjectListClient projects={items} />
    </div>
  )
}
