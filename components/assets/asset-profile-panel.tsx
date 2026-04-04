import { StatusBadge } from "@/components/shared/status-badge"
import { SectionCard } from "@/components/shared/section-card"
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

export function AssetProfilePanel({ asset }: { asset: Asset }) {
  const metadata = asset.metadata as Record<string, unknown> | null

  return (
    <SectionCard
      title="当前识别画像"
      eyebrow="Asset Profile"
      description="先回答「这个对象现在被识别成什么」，再决定是否进入受控验证或继续采集。"
    >
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-semibold text-slate-950 dark:text-white">{asset.value}</h3>
            <StatusBadge tone={kindTone[asset.kind]}>{ASSET_KIND_LABELS[asset.kind]}</StatusBadge>
          </div>
          {asset.label && asset.label !== asset.value && (
            <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">{asset.label}</p>
          )}
          {metadata && typeof metadata.description === "string" && (
            <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
              <p className="text-sm font-semibold text-slate-950 dark:text-white">描述</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{metadata.description}</p>
            </div>
          )}
        </div>

        <div className="grid gap-3">
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">资产标签</p>
            <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{asset.label || asset.value}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">置信度</p>
              <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                {(asset.confidence * 100).toFixed(0)}%
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">最近发现</p>
              <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                {new Date(asset.lastSeenAt).toLocaleDateString("zh-CN")}
              </p>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">首次发现</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {new Date(asset.firstSeenAt).toLocaleDateString("zh-CN")}
            </p>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
