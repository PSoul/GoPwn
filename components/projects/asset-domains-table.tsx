import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "@/components/shared/status-badge"
import type { Asset } from "@/lib/generated/prisma"
import { ASSET_KIND_LABELS } from "@/lib/types/labels"

type Props = {
  projectId: string
  assets: Asset[] // kind: domain | subdomain
  ipLookup?: Map<string, string> // IP value -> asset ID
}

export function AssetDomainsTable({ projectId, assets, ipLookup }: Props) {
  if (assets.length === 0) {
    return <p className="text-sm text-zinc-600 py-8 text-center">暂未发现域名资产</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>域名</TableHead>
          <TableHead>类型</TableHead>
          <TableHead>解析 IP</TableHead>
          <TableHead>发现时间</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => (
          <TableRow key={asset.id}>
            <TableCell className="font-mono text-sm">{asset.value}</TableCell>
            <TableCell>
              <StatusBadge tone={asset.kind === "domain" ? "info" : "neutral"}>
                {ASSET_KIND_LABELS[asset.kind]}
              </StatusBadge>
            </TableCell>
            <TableCell>
              {/* IP resolution: check metadata or related assets */}
              {asset.metadata && typeof asset.metadata === "object" && "resolvedIp" in (asset.metadata as Record<string, unknown>)
                ? (() => {
                    const resolvedIp = (asset.metadata as Record<string, string>).resolvedIp
                    const ipAssetId = ipLookup?.get(resolvedIp)
                    return ipAssetId ? (
                      <Link
                        href={`/projects/${projectId}/assets/ip/${ipAssetId}`}
                        className="text-blue-400 hover:underline font-mono text-sm"
                      >
                        {resolvedIp}
                      </Link>
                    ) : (
                      <span className="font-mono text-sm text-zinc-400">{resolvedIp}</span>
                    )
                  })()
                : <span className="text-zinc-600 text-sm">未解析</span>
              }
            </TableCell>
            <TableCell className="text-sm text-zinc-500">
              {new Date(asset.firstSeenAt).toLocaleDateString("zh-CN")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
