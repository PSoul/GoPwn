"use client"

import { cn } from "@/lib/utils"

type StubBadgeProps = {
  /** "local" = stub/mock mode, "real" = production connection */
  mode: "local" | "real"
  className?: string
}

/**
 * Visual indicator for whether a feature is using local stubs or a real backend.
 * Use this to make it obvious which parts of the UI are simulated vs live.
 */
export function StubBadge({ mode, className }: StubBadgeProps) {
  if (mode === "real") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
          "border border-emerald-300 bg-emerald-50 text-emerald-700",
          "dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
          className,
        )}
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
        已接入
      </span>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        "border border-amber-300 bg-amber-50 text-amber-700",
        "dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
        className,
      )}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
      本地模拟
    </span>
  )
}
