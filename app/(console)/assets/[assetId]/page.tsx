import Link from "next/link"
import { notFound } from "next/navigation"

import { AssetProfilePanel } from "@/components/assets/asset-profile-panel"
import { AssetRelations } from "@/components/assets/asset-relations"
import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { getStoredAssetById } from "@/lib/asset-repository"

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ assetId: string }>
}) {
  const { assetId } = await params
  const asset = await getStoredAssetById(assetId)

  if (!asset) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`资产详情 · ${asset.host}`}
        description="资产详情页围绕“当前识别画像 + 关系链路 + 下一步入口”组织，让研究员能快速决定是追加采集、做范围判断还是进入验证。"
        actions={
          <>
            <StatusBadge tone={asset.scopeStatus === "已确认" ? "success" : asset.scopeStatus === "待验证" ? "warning" : "info"}>
              {asset.scopeStatus}
            </StatusBadge>
            <Button asChild className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400">
              <Link href="/assets">返回资产中心</Link>
            </Button>
          </>
        }
      />

      <AssetProfilePanel asset={asset} />
      <AssetRelations asset={asset} />

      <SectionCard
        title="推进建议"
        eyebrow="Next Move"
        description="资产详情最后要给研究员一个清晰动作，而不是停留在静态描述。"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-sm font-semibold text-slate-950 dark:text-white">范围动作</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {asset.scopeStatus === "已确认" ? "维持当前范围归属，并继续补齐相关入口和证据。" : "先完成归属判断，再决定是否返回前置阶段。"}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-sm font-semibold text-slate-950 dark:text-white">验证动作</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              当前关联任务为“{asset.linkedTaskTitle}”，如需继续推进，应先确认审批与证据链状态。
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-sm font-semibold text-slate-950 dark:text-white">证据动作</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              若继续推进，优先检查 {asset.linkedEvidenceId} 是否完整，再决定是否新增采样或截图。
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
