import Link from "next/link"
import { notFound } from "next/navigation"
import { Network } from "lucide-react"

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
import type { AssetRecord } from "@/lib/prototype-types"

const scopeTone = {
  "已确认": "success",
  "待验证": "warning",
  "需人工判断": "info",
} as const

export default async function ProjectNetworkResultsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = await getStoredProjectById(projectId)

  if (!project) {
    notFound()
  }

  const assets = await listStoredAssetsByTypes(projectId, ["host", "ip", "port", "service"])

  return (
    <div className="space-y-5">
      <ProjectWorkspaceIntro
        title="端口"
        description="目标 IP 的开放端口、运行协议和服务识别结果。"
        actions={
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href={`/projects/${project.id}`}>返回项目详情</Link>
          </Button>
        }
      />

      <SectionCard title="扫描结果" description="Nmap 风格的端口与服务一览表。">
        {assets.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <Network className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </EmptyMedia>
              <EmptyTitle>暂未发现开放端口</EmptyTitle>
              <EmptyDescription>暂未发现开放端口。项目启动后，探测工具会自动扫描目标端口。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80 dark:bg-slate-900/70">
                  <TableRow>
                    <TableHead>IP</TableHead>
                    <TableHead>端口</TableHead>
                    <TableHead>协议</TableHead>
                    <TableHead>服务</TableHead>
                    <TableHead>产品/版本</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset) => (
                    <TableRow key={asset.id} className="bg-white/90 dark:bg-slate-950/70">
                      <TableCell className="font-mono text-sm text-slate-950 dark:text-white">
                        {asset.host || asset.label}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {extractPort(asset)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {extractProtocol(asset.exposure)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700 dark:text-slate-300">
                        {extractService(asset.profile, asset.exposure)}
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate text-sm text-slate-600 dark:text-slate-400">
                        {extractProduct(asset.profile)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={scopeTone[asset.scopeStatus]}>
                          {asset.scopeStatus}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Helper functions
 * ------------------------------------------------------------------------- */

function extractPort(asset: AssetRecord): string {
  if (asset.type === "port") {
    return asset.label
  }
  const match = asset.label.match(/:(\d+)$/)
  return match ? match[1] : "-"
}

function extractProtocol(exposure: string): string {
  if (!exposure) return "TCP"
  return exposure.toUpperCase().includes("UDP") ? "UDP" : "TCP"
}

function extractService(profile: string, exposure: string): string {
  const combined = `${profile} ${exposure}`.toLowerCase()
  const knownServices = [
    "ssh", "http", "https", "ftp", "smtp", "dns", "mysql",
    "postgresql", "mongodb", "redis", "telnet", "rdp", "smb",
    "pop3", "imap", "snmp", "ldap", "vnc", "mssql", "oracle",
  ]
  for (const svc of knownServices) {
    if (combined.includes(svc)) {
      return svc
    }
  }
  return "-"
}

function extractProduct(profile: string): string {
  if (!profile) return "-"
  return profile.length > 60 ? profile.slice(0, 60) + "..." : profile
}
