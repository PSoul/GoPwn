import { BrainCircuit } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import type { LlmSettingRecord } from "@/lib/prototype-types"

export function LlmSettingsPanel({ items }: { items: LlmSettingRecord[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.title}
          className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-slate-950 dark:text-white">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
            </div>
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <BrainCircuit className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-4 text-xl font-semibold text-slate-950 dark:text-white">{item.value}</p>
          <div className="mt-4">
            <StatusBadge tone="info">{item.owner}</StatusBadge>
          </div>
        </div>
      ))}
    </div>
  )
}
