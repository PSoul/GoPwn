import { StatusBadge } from "@/components/shared/status-badge"
import { SectionCard } from "@/components/shared/section-card"
import type { AssetRecord } from "@/lib/prototype-types"

function getScopeTone(scopeStatus: AssetRecord["scopeStatus"]) {
  if (scopeStatus === "已确认") {
    return "success" as const
  }

  if (scopeStatus === "待验证") {
    return "warning" as const
  }

  return "info" as const
}

export function AssetProfilePanel({ asset }: { asset: AssetRecord }) {
  return (
    <SectionCard
      title="当前识别画像"
      eyebrow="Asset Profile"
      description="先回答”这个对象现在被识别成什么”，再决定是否进入受控验证或继续采集。"
    >
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-semibold text-slate-950 dark:text-white">{asset.host}</h3>
            <StatusBadge tone={getScopeTone(asset.scopeStatus)}>{asset.scopeStatus}</StatusBadge>
          </div>
          <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">{asset.profile}</p>
          <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-sm font-semibold text-slate-950 dark:text-white">暴露说明</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{asset.exposure}</p>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">资产标签</p>
            <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{asset.label}</p>
          </div>
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">归属判断</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{asset.ownership}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">置信度</p>
              <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{asset.confidence}</p>
            </div>
            <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">最近发现</p>
              <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{asset.lastSeen}</p>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
