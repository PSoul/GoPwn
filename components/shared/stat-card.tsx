import { ArrowUpRight, type LucideIcon } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { cn } from "@/lib/utils"

const toneMap = {
  neutral: "from-slate-100 to-white dark:from-slate-900 dark:to-slate-950",
  info: "from-sky-100 to-white dark:from-sky-950/80 dark:to-slate-950",
  success: "from-emerald-100 to-white dark:from-emerald-950/80 dark:to-slate-950",
  warning: "from-amber-100 to-white dark:from-amber-950/80 dark:to-slate-950",
  danger: "from-rose-100 to-white dark:from-rose-950/80 dark:to-slate-950",
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
        "rounded-3xl border border-slate-200/80 bg-gradient-to-br p-5 shadow-[0_12px_40px_-32px_rgba(15,23,42,0.55)] dark:border-slate-800",
        toneMap[tone],
        className,
      )}
    >
      <div className="mb-5 flex items-start justify-between">
        <div className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <Icon className="h-5 w-5 text-slate-900 dark:text-slate-100" />
        </div>
        <StatusBadge tone={tone}>{label}</StatusBadge>
      </div>
      <div className="space-y-2">
        <div className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{value}</div>
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <ArrowUpRight className="h-4 w-4" />
          <span>{delta}</span>
        </div>
      </div>
    </div>
  )
}
