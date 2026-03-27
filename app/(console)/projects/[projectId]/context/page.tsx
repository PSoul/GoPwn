import Link from "next/link"
import { notFound } from "next/navigation"

import { ProjectKnowledgeTabs } from "@/components/projects/project-knowledge-tabs"
import { ProjectWorkspaceIntro } from "@/components/projects/project-workspace-intro"
import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { getProjectContextPayload } from "@/lib/prototype-api"

export default async function ProjectContextPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const payload = getProjectContextPayload(projectId)

  if (!payload) {
    notFound()
  }
  const { approvals, assets, detail, evidence, project } = payload

  return (
    <div className="space-y-5">
      <ProjectWorkspaceIntro
        title="证据与上下文"
        description="项目总览只保留结果入口，这个二级页专门承接证据、审批记录、补充情报和活动时间线。"
        actions={
          <>
            <StatusBadge tone={project.evidenceCount > 0 ? "info" : "neutral"}>证据 {project.evidenceCount}</StatusBadge>
            <Button asChild variant="outline" className="rounded-full px-5">
              <Link href={`/projects/${project.id}`}>返回项目详情</Link>
            </Button>
          </>
        }
      />

      <SectionCard title="当前沉淀概览" description={detail.target}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">证据条目</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{evidence.length}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">原始输出、截图摘要和结论锚点会在这里继续复核。</p>
          </div>
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">补充情报</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{detail.discoveredInfo.length}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">回流补采、资产归属和关键线索不再挤占项目总览主区。</p>
          </div>
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">活动时间线</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{detail.activity.length}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">用于复盘审批、证据归档和人工接管动作，不和结果表混排。</p>
          </div>
        </div>
      </SectionCard>

      <ProjectKnowledgeTabs detail={detail} approvals={approvals} assets={assets} evidence={evidence} />
    </div>
  )
}
