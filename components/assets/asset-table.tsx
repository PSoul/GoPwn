"use client"

import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { ArrowUpRight, Search } from "lucide-react"

import { Pagination } from "@/components/shared/pagination"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { cn } from "@/lib/utils"

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

const ASSET_PAGE_SIZE = 25

type KindFilter = "all" | AssetKind

const kindFilterOptions: Array<{ label: string; value: KindFilter }> = [
  { label: "全部类型", value: "all" },
  { label: "域名", value: "domain" },
  { label: "子域名", value: "subdomain" },
  { label: "IP", value: "ip" },
  { label: "端口", value: "port" },
  { label: "服务", value: "service" },
  { label: "Web 应用", value: "webapp" },
  { label: "API 端点", value: "api_endpoint" },
]

function matchesSearch(asset: Asset, query: string) {
  if (!query) return true
  const normalizedQuery = query.trim().toLowerCase()
  const haystack = [asset.value, asset.label].join(" ").toLowerCase()
  return haystack.includes(normalizedQuery)
}

export function AssetTable({
  assets,
  showControls = true,
  maxRows,
  className,
}: {
  assets: Asset[]
  showControls?: boolean
  maxRows?: number
  className?: string
}) {
  const [query, setQuery] = useState("")
  const [kindFilter, setKindFilter] = useState<KindFilter>("all")
  const [page, setPage] = useState(1)
  const resetPage = useCallback(() => setPage(1), [])

  const filteredRecords = useMemo(() => {
    const filtered = assets
      .filter((asset) => (kindFilter === "all" ? true : asset.kind === kindFilter))
      .filter((asset) => matchesSearch(asset, query))

    return typeof maxRows === "number" ? filtered.slice(0, maxRows) : filtered
  }, [assets, kindFilter, maxRows, query])

  const paginatedRecords = useMemo(() => {
    if (typeof maxRows === "number") return filteredRecords
    return filteredRecords.slice((page - 1) * ASSET_PAGE_SIZE, page * ASSET_PAGE_SIZE)
  }, [filteredRecords, maxRows, page])

  return (
    <div className={cn("space-y-4", className)}>
      {showControls && (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center justify-between gap-3">
            <StatusBadge tone="neutral">{`${filteredRecords.length} / ${assets.length}`}</StatusBadge>
          </div>
          <div className="grid gap-3 xl:grid-cols-[1.3fr_0.8fr]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => { setQuery(event.target.value); resetPage() }}
                placeholder="搜索资产值或标签..."
                className="h-11 rounded-2xl border-slate-200 bg-white pl-10 dark:border-slate-800 dark:bg-slate-950"
              />
            </label>
            <Select value={kindFilter} onValueChange={(value) => { setKindFilter(value as KindFilter); resetPage() }}>
              <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                <SelectValue placeholder="资产类型" />
              </SelectTrigger>
              <SelectContent>
                {kindFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/85 dark:bg-slate-900/80">
              <TableRow>
                <TableHead className="min-w-[200px]">标签</TableHead>
                <TableHead>类型</TableHead>
                <TableHead className="min-w-[200px]">值</TableHead>
                <TableHead>置信度</TableHead>
                <TableHead>最近发现</TableHead>
                <TableHead className="text-right">详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRecords.length > 0 ? (
                paginatedRecords.map((asset) => (
                  <TableRow key={asset.id} className="bg-white/95 dark:bg-slate-950/80">
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
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm" className="rounded-full px-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950">
                        <Link href={`/assets/${asset.id}`}>
                          查看画像
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="px-6 py-16 text-center">
                    <div className="mx-auto max-w-md space-y-2">
                      <p className="text-sm font-medium text-slate-950 dark:text-white">当前没有匹配结果</p>
                      <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {query || kindFilter !== "all"
                          ? "调整搜索词或类型筛选后再看一次。"
                          : "等真实任务执行后，这里会自动出现对应的资产对象。"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {typeof maxRows !== "number" && (
        <Pagination page={page} pageSize={ASSET_PAGE_SIZE} total={filteredRecords.length} onPageChange={setPage} />
      )}

      {typeof maxRows === "number" && assets.length > filteredRecords.length && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          当前仅预览前 {maxRows} 条记录，进入完整视图可查看全部数据。
        </p>
      )}
    </div>
  )
}
