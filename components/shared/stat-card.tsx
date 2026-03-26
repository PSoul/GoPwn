import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const toneMap = {
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-200",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200",
} as const

export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = "neutral",
  className,
}: {
  label: string
  value: string
  delta: string
  icon: LucideIcon
  tone?: keyof typeof toneMap
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-950",
        className,
      )}
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p>
          <div className="mt-2 text-[38px] font-semibold tracking-tight text-slate-950 dark:text-white">{value}</div>
        </div>
        <div className={cn("rounded-xl p-2", toneMap[tone])}>
          <Icon className="h-5 w-5 text-slate-900 dark:text-slate-100" />
        </div>
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{delta}</div>
    </div>
  )
}
