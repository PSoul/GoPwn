import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const toneStyles = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  info: "border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-200",
  success:
    "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
  warning:
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
  danger: "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200",
} as const

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode
  tone?: keyof typeof toneStyles
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", toneStyles[tone], className)}
    >
      {children}
    </Badge>
  )
}
