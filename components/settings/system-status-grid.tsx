import { Activity, Database, ServerCog, Workflow } from "lucide-react"

import type { SystemStatusRecord } from "@/lib/prototype-types"

const icons = [ServerCog, Workflow, Activity, Database]

export function SystemStatusGrid({ items }: { items: SystemStatusRecord[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => {
        const Icon = icons[index] ?? Activity

        return (
          <div
            key={item.title}
            className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{item.title}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{item.value}</p>
              </div>
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
          </div>
        )
      })}
    </div>
  )
}
