import Link from "next/link"

import { AssetCenterClient } from "@/components/assets/asset-center-client"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { listStoredAssets } from "@/lib/data/asset-repository"
import { buildAssetViews } from "@/lib/infra/api-compositions"

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const params = await searchParams
  const items = await listStoredAssets()
  const data = { items, total: items.length, views: buildAssetViews(items) }
  const { views } = data
  const pendingCount = items.filter((asset) => asset.scopeStatus !== "已确认").length

  return (
    <div className="space-y-6">
      <PageHeader
        title="资产中心"
        eyebrow="资产工作区"
        description="资产中心只展示真实执行结果。这里把域名 / Web、IP / 主机、端口 / 服务、指纹 / 技术栈、待验证对象拆成独立视图，避免随着项目规模扩大把所有内容挤在同一张页面里。"
        actions={
          <>
            <StatusBadge tone={pendingCount > 0 ? "warning" : "success"}>
              {pendingCount > 0 ? `${pendingCount} 个待验证 / 需人工判断对象` : "当前全部已确认"}
            </StatusBadge>
            <Button asChild className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200">
              <Link href="/projects">返回项目列表</Link>
            </Button>
          </>
        }
      />

      <AssetCenterClient views={views} initialView={params.view} />
    </div>
  )
}
