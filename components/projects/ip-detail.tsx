import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Asset, Finding, Severity } from "@/lib/generated/prisma"
import { SEVERITY_LABELS } from "@/lib/types/labels"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

const severityTone: Record<Severity, Tone> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "info",
  info: "neutral",
}

type PortWithServices = Asset & { children: Asset[] }

type Props = {
  projectId: string
  ipAsset: Asset
  associatedDomain: Asset | null
  ports: PortWithServices[]
  relatedFindings: Finding[]
  webApps: Asset[]
}

export function IpDetail({
  projectId,
  ipAsset,
  associatedDomain,
  ports,
  relatedFindings,
  webApps,
}: Props) {
  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/projects/${projectId}/assets?tab=hosts`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> 返回主机与端口
        </Link>
        <h2 className="text-2xl font-bold text-zinc-100 font-mono">
          {ipAsset.value}
        </h2>
        {associatedDomain && (
          <p className="text-sm text-zinc-500 mt-1">
            关联域名:{" "}
            <span className="text-zinc-300">{associatedDomain.value}</span>
          </p>
        )}
        <p className="text-sm text-zinc-600 mt-1">
          发现时间:{" "}
          {new Date(ipAsset.firstSeenAt).toLocaleDateString("zh-CN")}
        </p>
      </div>

      {/* Open Ports */}
      <section>
        <h3 className="text-sm font-medium text-zinc-400 mb-3">
          开放端口 ({ports.length})
        </h3>
        {ports.length === 0 ? (
          <p className="text-sm text-zinc-600 py-4 text-center">
            暂未发现开放端口
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>端口</TableHead>
                <TableHead>协议</TableHead>
                <TableHead>服务</TableHead>
                <TableHead>Banner/版本</TableHead>
                <TableHead>发现时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ports.map((port) => {
                const service = port.children[0]
                const metadata = port.metadata as Record<
                  string,
                  string
                > | null
                return (
                  <TableRow key={port.id}>
                    <TableCell className="font-mono text-sm">
                      {port.value}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-400">
                      {metadata?.protocol ?? "TCP"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {service?.label ?? metadata?.service ?? ""}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-400 max-w-[200px] truncate">
                      {metadata?.banner ?? service?.value ?? ""}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-500">
                      {new Date(port.firstSeenAt).toLocaleDateString("zh-CN")}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Related Findings */}
      <section>
        <h3 className="text-sm font-medium text-zinc-400 mb-3">
          关联漏洞 ({relatedFindings.length})
        </h3>
        {relatedFindings.length === 0 ? (
          <p className="text-sm text-zinc-600 py-4 text-center">
            暂无关联漏洞
          </p>
        ) : (
          <div className="space-y-2">
            {relatedFindings.map((f) => (
              <Link
                key={f.id}
                href={`/projects/${projectId}/vuln/${f.id}`}
                className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 hover:border-zinc-700 transition-colors"
              >
                <StatusBadge tone={severityTone[f.severity]}>
                  {SEVERITY_LABELS[f.severity]}
                </StatusBadge>
                <span className="text-sm text-zinc-300 flex-1 truncate">
                  {f.title}
                </span>
                {f.affectedTarget && (
                  <span className="text-xs font-mono text-zinc-600">
                    {f.affectedTarget}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Related Web Apps */}
      <section>
        <h3 className="text-sm font-medium text-zinc-400 mb-3">
          关联 Web 应用 ({webApps.length})
        </h3>
        {webApps.length === 0 ? (
          <p className="text-sm text-zinc-600 py-4 text-center">
            暂无关联 Web 应用
          </p>
        ) : (
          <div className="space-y-2">
            {webApps.map((app) => (
              <Link
                key={app.id}
                href={`/projects/${projectId}/assets?tab=web`}
                className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 hover:border-zinc-700 transition-colors"
              >
                <span className="text-sm font-mono text-blue-400 flex-1 truncate">
                  {app.value}
                </span>
                <span className="text-xs text-zinc-500">
                  {app.label !== app.value ? app.label : ""}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
