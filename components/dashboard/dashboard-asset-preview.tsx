"use client"

import Link from "next/link"
import { ArrowRight, Boxes } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import type { Asset, AssetKind } from "@/lib/generated/prisma"
import { ASSET_KIND_LABELS } from "@/lib/types/labels"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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

export function DashboardAssetPreview({ assets }: { assets: Asset[] }) {
  if (assets.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-slate-950 dark:text-white">
          <Boxes className="h-4 w-4" />
          全局资产预览
        </div>
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50/85 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/60">
          <p className="text-sm font-medium text-slate-950 dark:text-white">当前还没有真实资产数据</p>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            创建项目并开始执行后，域名、IP、端口、服务会自动沉淀到这里。
          </p>
        </div>
      </section>
    )
  }

  const preview = assets.slice(0, 8)

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-slate-950 dark:text-white">
          <Boxes className="h-4 w-4" />
          全局资产预览
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone="neutral">{assets.length} 条资产</StatusBadge>
          <Link
            href="/assets"
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            打开完整视图
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800">
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
            {preview.map((asset) => (
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

      {assets.length > 8 && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          仅预览前 8 条记录，进入完整视图可查看全部资产。
        </p>
      )}
    </section>
  )
}
