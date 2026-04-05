import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "@/components/shared/status-badge"
import type { Asset } from "@/lib/generated/prisma"
import { ASSET_KIND_LABELS } from "@/lib/types/labels"

type Props = {
  projectId: string
  assets: Asset[] // kind: webapp | api_endpoint
}

export function AssetWebTable({ projectId, assets }: Props) {
  if (assets.length === 0) {
    return <p className="text-sm text-zinc-600 py-8 text-center">暂未发现 Web 应用或 API 端点</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>URL</TableHead>
          <TableHead>类型</TableHead>
          <TableHead>标题/描述</TableHead>
          <TableHead>技术栈</TableHead>
          <TableHead>状态码</TableHead>
          <TableHead>发现时间</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => {
          const metadata = asset.metadata as Record<string, unknown> | null
          return (
            <TableRow key={asset.id}>
              <TableCell className="font-mono text-sm max-w-[300px] truncate">
                <a href={asset.value} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  {asset.value}
                </a>
              </TableCell>
              <TableCell>
                <StatusBadge tone={asset.kind === "webapp" ? "info" : "neutral"}>
                  {ASSET_KIND_LABELS[asset.kind]}
                </StatusBadge>
              </TableCell>
              <TableCell className="text-sm max-w-[200px] truncate">
                {asset.label !== asset.value ? asset.label : ""}
              </TableCell>
              <TableCell className="text-sm text-zinc-400">
                {metadata?.technology as string ?? ""}
              </TableCell>
              <TableCell className="text-sm font-mono">
                {metadata?.statusCode as string ?? ""}
              </TableCell>
              <TableCell className="text-sm text-zinc-500">
                {new Date(asset.firstSeenAt).toLocaleDateString("zh-CN")}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
