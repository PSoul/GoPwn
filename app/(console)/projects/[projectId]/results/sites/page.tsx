import Link from "next/link"
import { notFound } from "next/navigation"
import { Globe } from "lucide-react"

import { ProjectWorkspaceIntro } from "@/components/projects/project-workspace-intro"
import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { listStoredAssetsByTypes } from "@/lib/data/asset-repository"
import { getStoredProjectById } from "@/lib/project/project-repository"

const statusTone = {
  "已确认": "success",
  "待验证": "warning",
  "需人工判断": "info",
} as const

export default async function ProjectSitesResultsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = await getStoredProjectById(projectId)

  if (!project) {
    notFound()
  }

  const assets = await listStoredAssetsByTypes(projectId, ["entry", "web", "api"])

  return (
    <div className="space-y-5">
      <ProjectWorkspaceIntro
        title="Web 站点 / API"
        description="HTTP 服务、后台入口、API 端点等 Web 面资产独立成页，方便浏览和筛选。"
        actions={
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href={`/projects/${project.id}`}>返回项目详情</Link>
          </Button>
        }
      />

      <SectionCard title="站点列表" description="探测到的 Web 站点与 API 端点。">
        {assets.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <Globe className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </EmptyMedia>
              <EmptyTitle>暂未发现 Web 站点</EmptyTitle>
              <EmptyDescription>
                暂未发现 Web 站点。项目启动后，探测工具会自动识别 HTTP 服务。
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>状态码</TableHead>
                <TableHead>服务器/组件</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => {
                const title = extractField(asset.profile, "标题") || extractField(asset.profile, "title")
                const statusCode = extractField(asset.exposure, "状态码") || extractField(asset.exposure, "status")
                const server = extractField(asset.profile, "服务器") || extractField(asset.profile, "server")

                return (
                  <TableRow key={asset.id}>
                    <TableCell className="max-w-xs truncate font-mono text-xs">
                      {asset.label}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {title || "-"}
                    </TableCell>
                    <TableCell className="text-sm">{statusCode || "-"}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm">
                      {server || "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={statusTone[asset.scopeStatus] ?? "neutral"}>
                        {asset.scopeStatus}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  )
}

/** Extract a value for a given key from semi-structured text.
 *  Matches patterns like "标题：xxx", "标题: xxx", "title: xxx" etc.
 *  Returns the trimmed value or undefined if not found. */
function extractField(text: string | undefined | null, key: string): string | undefined {
  if (!text) return undefined
  const regex = new RegExp(`${key}[：:]\\s*(.+?)(?:\\n|$)`, "i")
  const match = text.match(regex)
  return match?.[1]?.trim() || undefined
}
