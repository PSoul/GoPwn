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
import type { Asset, AssetKind } from "@/lib/generated/prisma"
import { ASSET_KIND_LABELS } from "@/lib/types/labels"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

const kindTone: Record<AssetKind, Tone> = {
  domain: "info",
  subdomain: "info",
  ip: "neutral",
  port: "neutral",
  service: "warning",
  webapp: "success",
  api_endpoint: "success",
}

export function ProjectAssetTab({
  initialAssets,
}: {
  projectId: string
  initialAssets: Asset[]
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
              <TableHead>值</TableHead>
              <TableHead>置信度</TableHead>
              <TableHead>最近发现</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialAssets.map((asset) => (
              <TableRow key={asset.id} className="bg-white/90 dark:bg-slate-950/70">
                <TableCell className="font-medium text-slate-950 dark:text-white">
                  {asset.label || asset.value}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={kindTone[asset.kind]}>
                    {ASSET_KIND_LABELS[asset.kind]}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-sm text-slate-700 dark:text-slate-200">
                  {asset.value}
                </TableCell>
                <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                  {(asset.confidence * 100).toFixed(0)}%
                </TableCell>
                <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                  {new Date(asset.lastSeenAt).toLocaleDateString("zh-CN")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
