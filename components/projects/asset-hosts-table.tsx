import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Asset } from "@/lib/generated/prisma"

type Props = {
  projectId: string
  assets: Asset[] // kind: ip | port | service
}

export function AssetHostsTable({ projectId, assets }: Props) {
  if (assets.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">暂未发现主机与端口资产</p>
  }

  // Build rows: for port/service assets, extract host and port from value
  // Asset value formats: "ip" kind -> "10.0.1.1", "port" kind -> "8082", "service" kind -> "http"
  // Port assets typically have parent = ip asset
  const rows = assets
    .filter((a) => a.kind === "port")
    .map((portAsset) => {
      // Find parent IP
      const ipAsset = assets.find((a) => a.kind === "ip" && a.id === portAsset.parentId)
      const host = ipAsset?.value ?? ""
      // Find child service
      const serviceAsset = assets.find((a) => a.kind === "service" && a.parentId === portAsset.id)
      const metadata = portAsset.metadata as Record<string, string> | null
      return {
        id: portAsset.id,
        host,
        ipAssetId: ipAsset?.id,
        port: portAsset.value,
        protocol: metadata?.protocol ?? "TCP",
        service: serviceAsset?.label ?? metadata?.service ?? "",
        banner: metadata?.banner ?? serviceAsset?.value ?? "",
        firstSeenAt: portAsset.firstSeenAt,
      }
    })
    .sort((a, b) => a.host.localeCompare(b.host) || Number(a.port) - Number(b.port))

  // Also show standalone IP assets (no ports discovered yet)
  const ipsWithPorts = new Set(rows.map((r) => r.ipAssetId).filter(Boolean))
  const standaloneIps = assets.filter((a) => a.kind === "ip" && !ipsWithPorts.has(a.id))

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>主机</TableHead>
          <TableHead>端口</TableHead>
          <TableHead>协议</TableHead>
          <TableHead>服务</TableHead>
          <TableHead>Banner/版本</TableHead>
          <TableHead>发现时间</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {standaloneIps.map((ip) => (
          <TableRow key={ip.id}>
            <TableCell>
              <Link
                href={`/projects/${projectId}/assets/ip/${ip.id}`}
                className="text-blue-600 dark:text-blue-400 hover:underline font-mono text-sm"
              >
                {ip.value}
              </Link>
            </TableCell>
            <TableCell colSpan={4} className="text-slate-500 dark:text-slate-400 text-sm">端口扫描中...</TableCell>
            <TableCell className="text-sm text-slate-500 dark:text-slate-400">
              {new Date(ip.firstSeenAt).toLocaleDateString("zh-CN")}
            </TableCell>
          </TableRow>
        ))}
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              {row.ipAssetId ? (
                <Link
                  href={`/projects/${projectId}/assets/ip/${row.ipAssetId}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-mono text-sm"
                >
                  {row.host}
                </Link>
              ) : (
                <span className="font-mono text-sm">{row.host}</span>
              )}
            </TableCell>
            <TableCell className="font-mono text-sm">{row.port}</TableCell>
            <TableCell className="text-sm text-slate-500 dark:text-slate-400">{row.protocol}</TableCell>
            <TableCell className="text-sm">{row.service}</TableCell>
            <TableCell className="text-sm text-slate-500 dark:text-slate-400 max-w-[200px] truncate">{row.banner}</TableCell>
            <TableCell className="text-sm text-slate-500 dark:text-slate-400">
              {new Date(row.firstSeenAt).toLocaleDateString("zh-CN")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
