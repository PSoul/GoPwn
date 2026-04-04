"use client"

import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AssetRecord } from "@/lib/prototype-types"
import type { Tone } from "@/lib/prototype-types"

const typeTone: Record<string, Tone> = {
  domain: "info",
  host: "neutral",
  port: "neutral",
  web_entry: "success",
  service: "warning",
}

const scopeTone: Record<string, Tone> = {
  已确认: "success",
  需人工判断: "warning",
  待验证: "neutral",
  超出范围: "danger",
}

export function ProjectAssetTab({
  initialAssets,
}: {
  projectId: string
  initialAssets: AssetRecord[]
}) {
  if (initialAssets.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
        暂无资产记录
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-50/80 dark:bg-slate-900/70">
            <TableRow>
              <TableHead>标签</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>主机</TableHead>
              <TableHead>范围状态</TableHead>
              <TableHead>最近发现</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialAssets.map((asset) => (
              <TableRow key={asset.id} className="bg-white/90 dark:bg-slate-950/70">
                <TableCell className="font-medium text-slate-950 dark:text-white">
                  {asset.label}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={typeTone[asset.type] ?? "neutral"}>
                    {asset.type}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-sm text-slate-700 dark:text-slate-200">
                  {asset.host}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={scopeTone[asset.scopeStatus] ?? "neutral"}>
                    {asset.scopeStatus}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                  {asset.lastSeen}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
