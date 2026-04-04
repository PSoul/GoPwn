import Link from "next/link"
import { ArrowUpRight, CircleDot, Network } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
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

export function AssetRelations({ asset }: { asset: AssetRecord }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <SectionCard
        title="关系视图"
        eyebrow="Relation Graph"
        description="资产详情不只是一个对象卡片，还要把它与项目、证据、审批和入口关系连起来。"
      >
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-200">
                <Network className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">当前焦点</p>
                <p className="text-lg font-semibold text-slate-950 dark:text-white">{asset.host}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            {asset.relations.map((relation) => (
              <div
                key={relation.id}
                className="flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 rounded-full bg-slate-100 p-2 text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                    <CircleDot className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-950 dark:text-white">{relation.label}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {relation.type} · {relation.relation}
                    </p>
                  </div>
                </div>
                <StatusBadge tone={getScopeTone(relation.scopeStatus)}>{relation.scopeStatus}</StatusBadge>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="关联任务、证据、问题入口"
        eyebrow="Follow-ups"
        description="把研究员下一步真正会点开的入口放到同一块，不让页面变成静态档案。"
      >
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-sm font-semibold text-slate-950 dark:text-white">关联任务</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{asset.linkedTaskTitle}</p>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-sm font-semibold text-slate-950 dark:text-white">问题入口线索</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{asset.issueLead}</p>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-sm font-semibold text-slate-950 dark:text-white">关联证据编号</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{asset.linkedEvidenceId}</p>
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
