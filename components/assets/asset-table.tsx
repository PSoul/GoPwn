"use client"

import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { ArrowUpRight, Search } from "lucide-react"

import { Pagination } from "@/components/shared/pagination"
import { StatusBadge } from "@/components/shared/status-badge"

const ASSET_PAGE_SIZE = 25
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
import type { AssetCollectionView, AssetRecord } from "@/lib/prototype-types"
import { cn } from "@/lib/utils"

type ScopeFilter = "all" | AssetRecord["scopeStatus"]

type AssetColumn = {
  key: string
  header: string
  className?: string
  render: (asset: AssetRecord) => React.ReactNode
}

const scopeFilterOptions: Array<{ label: string; value: ScopeFilter }> = [
  { label: "全部状态", value: "all" },
  { label: "已纳入", value: "已纳入" },
  { label: "待确认", value: "待确认" },
  { label: "待复核", value: "待复核" },
]

function getScopeTone(scopeStatus: AssetRecord["scopeStatus"]) {
  if (scopeStatus === "已纳入") {
    return "success" as const
  }

  if (scopeStatus === "待确认") {
    return "warning" as const
  }

  return "info" as const
}

function getAssetTypeLabel(type: string) {
  return (
    {
      api: "API",
      cidr: "IP 段",
      domain: "域名",
      host: "主机",
      ip: "IP",
      page_entry: "页面入口",
      port: "端口",
      service: "服务",
      subdomain: "子域名",
      website: "Web 入口",
    }[type] ?? type
  )
}

function getColumnsForView(viewKey: AssetCollectionView["key"]): AssetColumn[] {
  if (viewKey === "domains-web") {
    return [
      {
        key: "entry",
        header: "域名 / Web 入口",
        className: "min-w-[280px]",
        render: (asset) => (
          <div className="space-y-1.5">
            <p className="font-medium text-slate-950 dark:text-white">{asset.label}</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {getAssetTypeLabel(asset.type)}
            </p>
          </div>
        ),
      },
      {
        key: "project",
        header: "所属项目",
        className: "min-w-[180px]",
        render: (asset) => (
          <div className="space-y-1">
            <p className="font-medium text-slate-950 dark:text-white">{asset.projectName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{asset.host}</p>
          </div>
        ),
      },
      {
        key: "profile",
        header: "画像 / 线索",
        className: "min-w-[260px]",
        render: (asset) => (
          <div className="space-y-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">
            <p>{asset.profile}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{asset.issueLead || asset.exposure}</p>
          </div>
        ),
      },
      {
        key: "ownership",
        header: "归属 / 置信度",
        className: "min-w-[180px]",
        render: (asset) => (
          <div className="space-y-1">
            <p className="text-sm text-slate-900 dark:text-slate-100">{asset.ownership}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{asset.confidence} 置信度</p>
          </div>
        ),
      },
      {
        key: "status",
        header: "范围状态",
        render: (asset) => <StatusBadge tone={getScopeTone(asset.scopeStatus)}>{asset.scopeStatus}</StatusBadge>,
      },
      {
        key: "lastSeen",
        header: "最近发现",
        className: "min-w-[140px]",
        render: (asset) => <span className="text-sm text-slate-600 dark:text-slate-300">{asset.lastSeen}</span>,
      },
    ]
  }

  if (viewKey === "hosts-ip") {
    return [
      {
        key: "host",
        header: "IP / 主机",
        className: "min-w-[220px]",
        render: (asset) => (
          <div className="space-y-1.5">
            <p className="font-medium text-slate-950 dark:text-white">{asset.label}</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {getAssetTypeLabel(asset.type)}
            </p>
          </div>
        ),
      },
      {
        key: "project",
        header: "所属项目",
        className: "min-w-[180px]",
        render: (asset) => (
          <div className="space-y-1">
            <p className="font-medium text-slate-950 dark:text-white">{asset.projectName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{asset.host}</p>
          </div>
        ),
      },
      {
        key: "exposure",
        header: "暴露 / 归属",
        className: "min-w-[220px]",
        render: (asset) => (
          <div className="space-y-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">
            <p>{asset.exposure}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{asset.ownership}</p>
          </div>
        ),
      },
      {
        key: "clue",
        header: "画像 / 线索",
        className: "min-w-[240px]",
        render: (asset) => (
          <div className="space-y-1">
            <p className="text-sm text-slate-900 dark:text-slate-100">{asset.profile}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{asset.issueLead}</p>
          </div>
        ),
      },
      {
        key: "status",
        header: "范围状态",
        render: (asset) => <StatusBadge tone={getScopeTone(asset.scopeStatus)}>{asset.scopeStatus}</StatusBadge>,
      },
      {
        key: "lastSeen",
        header: "最近发现",
        className: "min-w-[140px]",
        render: (asset) => <span className="text-sm text-slate-600 dark:text-slate-300">{asset.lastSeen}</span>,
      },
    ]
  }

  if (viewKey === "ports-services") {
    return [
      {
        key: "service",
        header: "端口 / 服务",
        className: "min-w-[240px]",
        render: (asset) => (
          <div className="space-y-1.5">
            <p className="font-medium text-slate-950 dark:text-white">{asset.label}</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {asset.exposure || getAssetTypeLabel(asset.type)}
            </p>
          </div>
        ),
      },
      {
        key: "host",
        header: "主机 / 项目",
        className: "min-w-[180px]",
        render: (asset) => (
          <div className="space-y-1">
            <p className="font-medium text-slate-950 dark:text-white">{asset.host}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{asset.projectName}</p>
          </div>
        ),
      },
      {
        key: "profile",
        header: "服务画像",
        className: "min-w-[260px]",
        render: (asset) => (
          <div className="space-y-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">
            <p>{asset.profile}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{asset.ownership}</p>
          </div>
        ),
      },
      {
        key: "clue",
        header: "关联任务 / 线索",
        className: "min-w-[240px]",
        render: (asset) => (
          <div className="space-y-1">
            <p className="text-sm text-slate-900 dark:text-slate-100">{asset.linkedTaskTitle || "等待回流"}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{asset.issueLead || asset.linkedEvidenceId}</p>
          </div>
        ),
      },
      {
        key: "status",
        header: "范围状态",
        render: (asset) => <StatusBadge tone={getScopeTone(asset.scopeStatus)}>{asset.scopeStatus}</StatusBadge>,
      },
      {
        key: "lastSeen",
        header: "最近发现",
        className: "min-w-[140px]",
        render: (asset) => <span className="text-sm text-slate-600 dark:text-slate-300">{asset.lastSeen}</span>,
      },
    ]
  }

  if (viewKey === "fingerprints") {
    return [
      {
        key: "fingerprint",
        header: "指纹 / 技术栈",
        className: "min-w-[260px]",
        render: (asset) => (
          <div className="space-y-1.5">
            <p className="font-medium text-slate-950 dark:text-white">{asset.label}</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{asset.profile}</p>
          </div>
        ),
      },
      {
        key: "source",
        header: "来源对象",
        className: "min-w-[180px]",
        render: (asset) => (
          <div className="space-y-1">
            <p className="font-medium text-slate-950 dark:text-white">{asset.host}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{asset.projectName}</p>
          </div>
        ),
      },
      {
        key: "clue",
        header: "线索 / 暴露面",
        className: "min-w-[260px]",
        render: (asset) => (
          <div className="space-y-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">
            <p>{asset.exposure}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{asset.issueLead}</p>
          </div>
        ),
      },
      {
        key: "evidence",
        header: "证据 / 置信度",
        className: "min-w-[180px]",
        render: (asset) => (
          <div className="space-y-1">
            <p className="text-sm text-slate-900 dark:text-slate-100">{asset.linkedEvidenceId || "等待关联证据"}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{asset.confidence} 置信度</p>
          </div>
        ),
      },
      {
        key: "status",
        header: "范围状态",
        render: (asset) => <StatusBadge tone={getScopeTone(asset.scopeStatus)}>{asset.scopeStatus}</StatusBadge>,
      },
      {
        key: "lastSeen",
        header: "最近发现",
        className: "min-w-[140px]",
        render: (asset) => <span className="text-sm text-slate-600 dark:text-slate-300">{asset.lastSeen}</span>,
      },
    ]
  }

  return [
    {
      key: "asset",
      header: "待确认对象",
      className: "min-w-[260px]",
      render: (asset) => (
        <div className="space-y-1.5">
          <p className="font-medium text-slate-950 dark:text-white">{asset.label}</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {getAssetTypeLabel(asset.type)}
          </p>
        </div>
      ),
    },
    {
      key: "project",
      header: "所属项目",
      className: "min-w-[180px]",
      render: (asset) => (
        <div className="space-y-1">
          <p className="font-medium text-slate-950 dark:text-white">{asset.projectName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{asset.host}</p>
        </div>
      ),
    },
    {
      key: "ownership",
      header: "归属 / 画像",
      className: "min-w-[260px]",
      render: (asset) => (
        <div className="space-y-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">
          <p>{asset.ownership}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{asset.profile}</p>
        </div>
      ),
    },
    {
      key: "trace",
      header: "关联线索",
      className: "min-w-[220px]",
      render: (asset) => (
        <div className="space-y-1">
          <p className="text-sm text-slate-900 dark:text-slate-100">{asset.linkedTaskTitle || "等待任务回流"}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{asset.issueLead || asset.exposure}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "范围状态",
      render: (asset) => <StatusBadge tone={getScopeTone(asset.scopeStatus)}>{asset.scopeStatus}</StatusBadge>,
    },
    {
      key: "lastSeen",
      header: "最近发现",
      className: "min-w-[140px]",
      render: (asset) => <span className="text-sm text-slate-600 dark:text-slate-300">{asset.lastSeen}</span>,
    },
  ]
}

function matchesSearch(asset: AssetRecord, query: string) {
  if (!query) {
    return true
  }

  const normalizedQuery = query.trim().toLowerCase()
  const haystack = [
    asset.label,
    asset.host,
    asset.projectName,
    asset.profile,
    asset.exposure,
    asset.issueLead,
    asset.linkedTaskTitle,
    asset.linkedEvidenceId,
    asset.ownership,
  ]
    .join(" ")
    .toLowerCase()

  return haystack.includes(normalizedQuery)
}

export function AssetTable({
  view,
  showControls = true,
  maxRows,
  className,
}: {
  view: AssetCollectionView
  showControls?: boolean
  maxRows?: number
  className?: string
}) {
  const [query, setQuery] = useState("")
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all")
  const [page, setPage] = useState(1)
  const resetPage = useCallback(() => setPage(1), [])

  const filteredRecords = useMemo(() => {
    const scoped = view.items.filter((asset) => (scopeFilter === "all" ? true : asset.scopeStatus === scopeFilter))
    const searched = scoped.filter((asset) => matchesSearch(asset, query))

    return typeof maxRows === "number" ? searched.slice(0, maxRows) : searched
  }, [maxRows, query, scopeFilter, view.items])

  const paginatedRecords = useMemo(() => {
    if (typeof maxRows === "number") return filteredRecords
    return filteredRecords.slice((page - 1) * ASSET_PAGE_SIZE, page * ASSET_PAGE_SIZE)
  }, [filteredRecords, maxRows, page])

  const columns = getColumnsForView(view.key)
  const pendingCount = view.items.filter((asset) => asset.scopeStatus !== "已纳入").length

  return (
    <div className={cn("space-y-4", className)}>
      {showControls ? (
        <div className="flex flex-col gap-3 rounded-[28px] border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-950 dark:text-white">{view.label}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{view.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge tone={pendingCount > 0 ? "warning" : "success"}>
                {pendingCount > 0 ? `${pendingCount} 个待确认 / 待复核` : "当前全部已纳入"}
              </StatusBadge>
              <StatusBadge tone="neutral">{`${filteredRecords.length} / ${view.items.length}`}</StatusBadge>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[1.3fr_0.8fr]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => { setQuery(event.target.value); resetPage() }}
                placeholder="搜索对象、主机、项目、画像或证据线索..."
                className="h-11 rounded-2xl border-slate-200 bg-white pl-10 dark:border-slate-800 dark:bg-slate-950"
              />
            </label>

            <Select value={scopeFilter} onValueChange={(value) => { setScopeFilter(value as ScopeFilter); resetPage() }}>
              <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                <SelectValue placeholder="范围状态" />
              </SelectTrigger>
              <SelectContent>
                {scopeFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/85 dark:bg-slate-900/80">
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.key} className={column.className}>
                    {column.header}
                  </TableHead>
                ))}
                <TableHead className="min-w-[120px] text-right">详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRecords.length > 0 ? (
                paginatedRecords.map((asset) => (
                  <TableRow key={asset.id} className="bg-white/95 align-top dark:bg-slate-950/80">
                    {columns.map((column) => (
                      <TableCell key={`${asset.id}-${column.key}`} className={cn("py-4", column.className)}>
                        {column.render(asset)}
                      </TableCell>
                    ))}
                    <TableCell className="py-4 text-right">
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
                  <TableCell colSpan={columns.length + 1} className="px-6 py-16 text-center">
                    <div className="mx-auto max-w-md space-y-2">
                      <p className="text-sm font-medium text-slate-950 dark:text-white">当前视图还没有匹配结果</p>
                      <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {query || scopeFilter !== "all"
                          ? "调整搜索词或范围状态后再看一次。"
                          : "等真实任务继续回流后，这里会自动出现对应的资产对象。"}
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

      {typeof maxRows === "number" && view.items.length > filteredRecords.length ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          当前仅预览前 {maxRows} 条记录，进入完整视图可查看该类型的全部真实数据。
        </p>
      ) : null}
    </div>
  )
}
