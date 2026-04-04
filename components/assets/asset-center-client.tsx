"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Boxes, FolderKanban, ShieldCheck } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import type { Asset, AssetKind } from "@/lib/generated/prisma"
import { ASSET_KIND_LABELS } from "@/lib/types/labels"
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
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/shared/pagination"

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

const kindFilterOptions: Array<{ label: string; value: string }> = [
  { label: "全部类型", value: "all" },
  { label: "域名", value: "domain" },
  { label: "子域名", value: "subdomain" },
  { label: "IP", value: "ip" },
  { label: "端口", value: "port" },
  { label: "服务", value: "service" },
  { label: "Web 应用", value: "webapp" },
  { label: "API 端点", value: "api_endpoint" },
]

export function AssetCenterClient({
  initialAssets,
}: {
  initialAssets: Asset[]
}) {
  const [query, setQuery] = useState("")
  const [kindFilter, setKindFilter] = useState("all")
  const [page, setPage] = useState(1)

  const projectCount = useMemo(
    () => new Set(initialAssets.map((a) => a.projectId)).size,
    [initialAssets],
  )

  const filteredAssets = useMemo(() => {
    return initialAssets.filter((asset) => {
      if (kindFilter !== "all" && asset.kind !== kindFilter) return false
      if (query) {
        const q = query.trim().toLowerCase()
        const haystack = [asset.value, asset.label, asset.kind].join(" ").toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [initialAssets, kindFilter, query])

  const paginatedAssets = useMemo(
    () => filteredAssets.slice((page - 1) * ASSET_PAGE_SIZE, page * ASSET_PAGE_SIZE),
    [filteredAssets, page],
  )

  const summaryCards = [
    {
      label: "资产总数",
      value: String(initialAssets.length),
      detail: "所有项目汇总的统一资产视图。",
      icon: Boxes,
    },
    {
      label: "高置信度",
      value: String(initialAssets.filter((a) => a.confidence >= 0.8).length),
      detail: "置信度 80% 以上的资产数量。",
      icon: ShieldCheck,
    },
    {
      label: "低置信度 / 待验证",
      value: String(initialAssets.filter((a) => a.confidence < 0.8).length),
      detail: "仍需继续判断真实性的对象。",
      icon: AlertTriangle,
    },
    {
      label: "覆盖项目",
      value: String(projectCount),
      detail: "当前已有真实资产沉淀的项目数量。",
      icon: FolderKanban,
    },
  ]

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{card.label}</p>
                <p className="mt-3 text-[34px] font-semibold tracking-tight text-slate-950 dark:text-white">{card.value}</p>
              </div>
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <card.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{card.detail}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-4 dark:border-slate-800">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Asset Workspace
            </p>
            <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-slate-950 dark:text-white">资产中心</h2>
          </div>

          <div className="grid gap-3 xl:grid-cols-[1.3fr_0.8fr]">
            <Input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(1) }}
              placeholder="搜索资产值、标签..."
              className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
            />
            <Select value={kindFilter} onValueChange={(value) => { setKindFilter(value); setPage(1) }}>
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
              {paginatedAssets.length > 0 ? (
                paginatedAssets.map((asset) => (
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
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="px-6 py-16 text-center">
                    <p className="text-sm font-medium text-slate-950 dark:text-white">当前没有匹配结果</p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      {query || kindFilter !== "all"
                        ? "调整搜索词或类型筛选后再看一次。"
                        : "等真实任务执行后，这里会自动出现对应的资产对象。"}
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4">
          <Pagination page={page} pageSize={ASSET_PAGE_SIZE} total={filteredAssets.length} onPageChange={setPage} />
        </div>
      </section>
    </div>
  )
}
