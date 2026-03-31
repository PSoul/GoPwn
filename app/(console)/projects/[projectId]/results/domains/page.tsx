import Link from "next/link"
import { notFound } from "next/navigation"
import { Globe } from "lucide-react"

import { ProjectWorkspaceIntro } from "@/components/projects/project-workspace-intro"
import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import { listStoredAssetsByTypes } from "@/lib/asset-repository"
import { getStoredProjectById } from "@/lib/project-repository"

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/

function statusTone(status: string) {
  switch (status) {
    case "已确认":
      return "success" as const
    case "待验证":
      return "warning" as const
    case "需人工判断":
      return "info" as const
    default:
      return "neutral" as const
  }
}

export default async function ProjectDomainsResultsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = await getStoredProjectById(projectId)

  if (!project) {
    notFound()
  }

  const assets = await listStoredAssetsByTypes(projectId, ["domain", "subdomain"])

  const allTargetsAreIPs = project.targets.length > 0 && project.targets.every((t) => IP_REGEX.test(t.trim()))

  return (
    <div className="space-y-5">
      <ProjectWorkspaceIntro
        title="域名资产"
        description="主域名与子域名资产列表，来源于自动化探测与手动录入。"
        actions={
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href={`/projects/${project.id}`}>返回项目详情</Link>
          </Button>
        }
      />

      <SectionCard title="域名列表" description="当前项目已发现的域名与子域名资产。">
        {assets.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <Globe className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </EmptyMedia>
              <EmptyTitle>暂无域名资产</EmptyTitle>
              <EmptyDescription>
                {allTargetsAreIPs
                  ? "当前目标为 IP 地址，无域名资产。可在端口 Tab 查看网络层探测结果。"
                  : "项目启动后，探测工具会自动发现域名和子域名。"}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="pb-3 pr-4">域名</th>
                  <th className="pb-3 pr-4">类型</th>
                  <th className="pb-3 pr-4">解析 IP</th>
                  <th className="pb-3 pr-4">来源</th>
                  <th className="pb-3">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {assets.map((asset) => (
                  <tr key={asset.id} className="text-slate-700 dark:text-slate-200">
                    <td className="py-2.5 pr-4 font-medium">{asset.label}</td>
                    <td className="py-2.5 pr-4">
                      {asset.type === "domain" ? "主域名" : "子域名"}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {asset.host || "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-500 dark:text-slate-400">
                      {asset.ownership || "—"}
                    </td>
                    <td className="py-2.5">
                      <StatusBadge tone={statusTone(asset.scopeStatus)}>
                        {asset.scopeStatus}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
