"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

const typeColor: Record<string, string> = {
  tool_started: "bg-sky-500",
  tool_completed: "bg-emerald-500",
  vuln_found: "bg-rose-500",
  asset_discovered: "bg-cyan-500",
  approval_needed: "bg-amber-500",
  round_completed: "bg-purple-500",
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toTimeString().slice(0, 8)
  } catch {
    return iso
  }
}

export function ProjectActivityLog({
  logs,
}: {
  logs: Array<{ type: string; message: string; timestamp: string }>
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs.length])

  if (logs.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
        暂无执行日志
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className="max-h-[480px] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
    >
      <div className="space-y-3">
        {logs.map((log, i) => (
          <div key={`${log.timestamp}-${i}`} className="flex items-start gap-3">
            <div className="mt-1.5 flex shrink-0 items-center">
              <span
                className={cn(
                  "block h-2.5 w-2.5 rounded-full",
                  typeColor[log.type] ?? "bg-slate-400",
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-900 dark:text-white">{log.message}</p>
              <p className="mt-0.5 text-xs text-slate-400">{formatTime(log.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
