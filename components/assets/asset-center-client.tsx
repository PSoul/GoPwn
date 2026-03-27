"use client"

import Link from "next/link"
import { useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Boxes, FolderKanban, ShieldCheck } from "lucide-react"

import { AssetTable } from "@/components/assets/asset-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getPreferredAssetViewKey } from "@/lib/asset-view-selection"
import type { AssetCollectionView } from "@/lib/prototype-types"

export function AssetCenterClient({
  views,
  initialView,
}: {
  views: AssetCollectionView[]
  initialView?: string | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const selectedKey = getPreferredAssetViewKey(views, initialView ?? null)
  const selectedView = views.find((view) => view.key === selectedKey) ?? views[0]

  const uniqueAssets = useMemo(() => {
    const deduped = new Map<string, (typeof views)[number]["items"][number]>()

    views.flatMap((view) => view.items).forEach((asset) => {
      deduped.set(asset.id, asset)
    })

    return [...deduped.values()]
  }, [views])

  const inScopeCount = uniqueAssets.filter((asset) => asset.scopeStatus === "已纳入").length
  const pendingCount = uniqueAssets.filter((asset) => asset.scopeStatus !== "已纳入").length
  const projectCount = new Set(uniqueAssets.map((asset) => asset.projectId)).size

  const summaryCards = [
    {
      label: "资产总数",
      value: String(uniqueAssets.length),
      detail: "所有项目回流到平台后的统一资产视图。",
      icon: Boxes,
    },
    {
      label: "已纳入范围",
      value: String(inScopeCount),
      detail: "已确认可继续推进验证与证据沉淀的对象。",
      icon: ShieldCheck,
    },
    {
      label: "待确认 / 待复核",
      value: String(pendingCount),
      detail: "仍需继续判断归属、授权或技术真实性的对象。",
      icon: AlertTriangle,
    },
    {
      label: "覆盖项目",
      value: String(projectCount),
      detail: "当前已有真实资产沉淀的项目数量。",
      icon: FolderKanban,
    },
  ]

  const handleViewChange = (nextView: string) => {
    router.replace(`${pathname}?view=${nextView}`, { scroll: false })
  }

  if (!selectedView) {
    return null
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-[28px] border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"
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

      <section className="rounded-[32px] border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Asset Workspace
              </p>
              <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-slate-950 dark:text-white">{selectedView.label}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{selectedView.description}</p>
            </div>

            <div className="flex items-center gap-2">
              <StatusBadge tone={selectedView.key === "pending-review" ? "warning" : "neutral"}>
                {selectedView.count} 条真实记录
              </StatusBadge>
              {selectedView.key === "pending-review" ? (
                <Link
                  href="/approvals"
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  查看待审批动作
                </Link>
              ) : null}
            </div>
          </div>

          <Tabs value={selectedView.key} onValueChange={handleViewChange}>
            <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-[24px] bg-slate-100/85 p-2 dark:bg-slate-900/80">
              {views.map((view) => (
                <TabsTrigger
                  key={view.key}
                  value={view.key}
                  className="rounded-2xl px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-950"
                >
                  <span>{view.label}</span>
                  <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{view.count}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="pt-5">
          <AssetTable view={selectedView} />
        </div>
      </section>
    </div>
  )
}
