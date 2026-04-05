"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { Asset } from "@/lib/generated/prisma"

type Props = {
  assets: Asset[] // kind: webapp | api_endpoint
  portAssets?: Asset[] // kind: port, used for service label lookup
}

type AssetGroup = {
  origin: string
  serviceLabel: string
  webappCount: number
  endpointCount: number
  items: Array<{
    asset: Asset
    path: string // pathname + search (without origin)
  }>
}

function buildGroups(assets: Asset[], portAssets?: Asset[]): AssetGroup[] {
  const groupMap = new Map<string, AssetGroup>()
  const otherKey = "__other__"

  for (const asset of assets) {
    let origin: string
    let path: string
    try {
      const url = new URL(asset.value)
      origin = url.origin
      path = url.pathname + url.search
    } catch {
      origin = otherKey
      path = asset.value
    }

    if (!groupMap.has(origin)) {
      groupMap.set(origin, {
        origin,
        serviceLabel: "",
        webappCount: 0,
        endpointCount: 0,
        items: [],
      })
    }

    const group = groupMap.get(origin)!
    group.items.push({ asset, path })
    if (asset.kind === "webapp") group.webappCount++
    else group.endpointCount++
  }

  // Resolve service labels from port assets
  if (portAssets && portAssets.length > 0) {
    for (const [origin, group] of groupMap) {
      if (origin === otherKey) continue
      try {
        const url = new URL(origin)
        const port = url.port || (url.protocol === "https:" ? "443" : "80")
        const portAsset = portAssets.find((p) => p.value === port || p.value === `${url.hostname}:${port}`)
        if (portAsset && portAsset.label && !portAsset.label.startsWith("HTTP on ")) {
          group.serviceLabel = portAsset.label
        }
      } catch { /* skip */ }
    }
  }

  // Sort items within each group: webapp first, then by path
  for (const group of groupMap.values()) {
    group.items.sort((a, b) => {
      if (a.asset.kind !== b.asset.kind) {
        return a.asset.kind === "webapp" ? -1 : 1
      }
      return a.path.localeCompare(b.path)
    })
  }

  // Sort groups: by item count descending, "other" always last
  const groups = [...groupMap.values()]
  groups.sort((a, b) => {
    if (a.origin === otherKey) return 1
    if (b.origin === otherKey) return -1
    return b.items.length - a.items.length
  })

  // Rename "other" origin
  const other = groups.find((g) => g.origin === otherKey)
  if (other) other.origin = "其他"

  return groups
}

export function AssetWebTable({ assets, portAssets }: Props) {
  const groups = buildGroups(assets, portAssets)

  // Default: expand first group if > 3 groups, else expand all
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (groups.length <= 3) return new Set(groups.map((g) => g.origin))
    return new Set(groups.length > 0 ? [groups[0].origin] : [])
  })

  if (assets.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">暂未发现 Web 应用或 API 端点</p>
  }

  function toggleGroup(origin: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(origin)) next.delete(origin)
      else next.add(origin)
      return next
    })
  }

  function expandAll() {
    setExpanded(new Set(groups.map((g) => g.origin)))
  }

  function collapseAll() {
    setExpanded(new Set())
  }

  const allExpanded = expanded.size === groups.length

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-slate-500"
          onClick={allExpanded ? collapseAll : expandAll}
        >
          {allExpanded ? (
            <><ChevronsDownUp className="mr-1 h-3.5 w-3.5" />全部收起</>
          ) : (
            <><ChevronsUpDown className="mr-1 h-3.5 w-3.5" />全部展开</>
          )}
        </Button>
      </div>

      {/* Groups */}
      {groups.map((group) => {
        const isOpen = expanded.has(group.origin)
        const countText = [
          group.webappCount > 0 ? `${group.webappCount} 个应用` : null,
          group.endpointCount > 0 ? `${group.endpointCount} 个端点` : null,
        ].filter(Boolean).join(" / ")

        return (
          <div
            key={group.origin}
            className="rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950"
          >
            {/* Group Header */}
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors"
              onClick={() => toggleGroup(group.origin)}
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              )}
              <span className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                {group.origin}
              </span>
              {group.serviceLabel && (
                <>
                  <span className="text-slate-300 dark:text-slate-600">—</span>
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    {group.serviceLabel}
                  </span>
                </>
              )}
              <span className="ml-auto shrink-0 text-xs text-slate-500 dark:text-slate-400">
                {countText}
              </span>
            </button>

            {/* Group Content */}
            {isOpen && (
              <div className="border-t border-slate-100 dark:border-slate-800">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>路径</TableHead>
                      <TableHead className="w-24">类型</TableHead>
                      <TableHead>标题/描述</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.items.map(({ asset, path }) => (
                      <TableRow key={asset.id}>
                        <TableCell className="font-mono text-sm max-w-[400px]">
                          <a
                            href={asset.value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline truncate block"
                            title={asset.value}
                          >
                            {path || "/"}
                          </a>
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={asset.kind === "webapp" ? "info" : "neutral"}>
                            {asset.kind === "webapp" ? "应用" : "端点"}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-sm max-w-[250px] truncate" title={asset.label}>
                          {asset.label !== asset.value ? asset.label : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
