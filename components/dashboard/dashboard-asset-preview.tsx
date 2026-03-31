"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowRight, Boxes } from "lucide-react"

import { AssetTable } from "@/components/assets/asset-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getPreferredAssetViewKey } from "@/lib/asset-view-selection"
import type { AssetCollectionView } from "@/lib/prototype-types"

export function DashboardAssetPreview({ views }: { views: AssetCollectionView[] }) {
  const [selectedKey, setSelectedKey] = useState<AssetCollectionView["key"]>(
    getPreferredAssetViewKey(views) ?? "domains-web",
  )

  const selectedView = useMemo(
    () => views.find((view) => view.key === selectedKey) ?? views[0],
    [selectedKey, views],
  )

  if (!selectedView) {
    return (
      <section className="rounded-hero border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-slate-950 dark:text-white">
          <Boxes className="h-4 w-4" />
          全局资产预览
        </div>
        <div className="mt-5 rounded-card border border-dashed border-slate-300 bg-slate-50/85 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/60">
          <p className="text-sm font-medium text-slate-950 dark:text-white">当前还没有真实资产数据</p>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            创建项目并开始执行后，域名、IP、端口、服务与指纹会自动沉淀到这里。
          </p>
        </div>
      </section>
    )
  }

  const pendingCount = selectedView.items.filter((asset) => asset.scopeStatus !== "已确认").length

  return (
    <section className="rounded-hero border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-4 dark:border-slate-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[15px] font-semibold text-slate-950 dark:text-white">
              <Boxes className="h-4 w-4" />
              全局资产预览
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              仪表盘只保留四类核心结果视图，让研究员先判断已经拿到了什么，而不是先被控制逻辑打断。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge tone={pendingCount > 0 ? "warning" : "success"}>
              {pendingCount > 0 ? `${pendingCount} 条待验证线索` : "当前视图已全部确认"}
            </StatusBadge>
            <Link
              href={`/assets?view=${selectedView.key}`}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              打开完整视图
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <Tabs value={selectedView.key} onValueChange={(value) => setSelectedKey(value as AssetCollectionView["key"])}>
          <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-panel bg-slate-100/85 p-2 dark:bg-slate-900/80">
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
        <AssetTable view={selectedView} showControls={false} maxRows={6} />
      </div>
    </section>
  )
}
