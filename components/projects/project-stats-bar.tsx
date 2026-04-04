"use client"

import { cn } from "@/lib/utils"

interface StatCard {
  label: string
  value: number
  tone: "neutral" | "info" | "success" | "warning" | "danger"
}

const toneBorder: Record<StatCard["tone"], string> = {
  neutral: "border-slate-200/80 dark:border-slate-800",
  info: "border-sky-200/80 dark:border-sky-900/60",
  success: "border-emerald-200/80 dark:border-emerald-900/60",
  warning: "border-amber-200/80 dark:border-amber-900/60",
  danger: "border-rose-200/80 dark:border-rose-900/60",
}

const toneText: Record<StatCard["tone"], string> = {
  neutral: "text-slate-950 dark:text-white",
  info: "text-sky-700 dark:text-sky-300",
  success: "text-emerald-700 dark:text-emerald-300",
  warning: "text-amber-700 dark:text-amber-300",
  danger: "text-rose-700 dark:text-rose-300",
}

export function ProjectStatsBar({
  assetCount,
  vulnCount,
  highCount,
  pendingApprovals,
}: {
  assetCount: number
  vulnCount: number
  highCount: number
  pendingApprovals: number
}) {
  const cards: StatCard[] = [
    { label: "已发现资产", value: assetCount, tone: "info" },
    { label: "已发现漏洞", value: vulnCount, tone: "neutral" },
    { label: "高危漏洞", value: highCount, tone: highCount > 0 ? "danger" : "neutral" },
    { label: "待审批", value: pendingApprovals, tone: pendingApprovals > 0 ? "warning" : "neutral" },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={cn(
            "rounded-xl border bg-white p-3 dark:bg-slate-950",
            toneBorder[card.tone],
          )}
        >
          <p className="text-xs text-slate-500 dark:text-slate-400">{card.label}</p>
          <p
            className={cn(
              "mt-1 text-2xl font-semibold transition-all duration-300",
              toneText[card.tone],
            )}
          >
            {card.value}
          </p>
        </div>
      ))}
    </div>
  )
}
