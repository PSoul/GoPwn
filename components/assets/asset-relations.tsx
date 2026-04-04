import Link from "next/link"
import { ArrowUpRight, CircleDot, Network } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
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

export function AssetRelations({
  asset,
  relatedAssets,
}: {
  asset: Asset
  relatedAssets: Asset[]
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <SectionCard
        title="关系视图"
        eyebrow="Relation Graph"
        description="展示当前资产与其他关联资产的关系。"
      >
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-200">
                <Network className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">当前焦点</p>
                <p className="text-lg font-semibold text-slate-950 dark:text-white">{asset.value}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            {relatedAssets.length > 0 ? (
              relatedAssets.map((related) => (
                <div
                  key={related.id}
                  className="flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 rounded-full bg-slate-100 p-2 text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                      <CircleDot className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-950 dark:text-white">{related.label || related.value}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {ASSET_KIND_LABELS[related.kind]} · {related.value}
                      </p>
                    </div>
                  </div>
                  <StatusBadge tone={kindTone[related.kind]}>{ASSET_KIND_LABELS[related.kind]}</StatusBadge>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                当前资产没有关联的其他资产。
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="关联入口"
        eyebrow="Follow-ups"
        description="把研究员下一步真正会用到的入口放到同一块。"
      >
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-sm font-semibold text-slate-950 dark:text-white">资产详情</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{asset.value}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              置信度 {(asset.confidence * 100).toFixed(0)}% · {ASSET_KIND_LABELS[asset.kind]}
            </p>
            {asset.projectId && (
              <Button asChild variant="ghost" className="mt-3 h-auto rounded-full px-0 text-sky-700 hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200">
                <Link href={`/projects/${asset.projectId}`}>
                  查看项目详情
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
