import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

type SettingsSection = {
  href: string
  title: string
  description: string
  metric: string
  tone: Tone
}

export function SettingsHubGrid({ sections }: { sections: SettingsSection[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {sections.map((section) => (
        <Link
          key={section.href}
          href={section.href}
          className="group rounded-2xl border border-slate-200/80 bg-white/90 p-5 transition-transform hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-950/70"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-slate-950 group-hover:text-slate-700 dark:text-white dark:group-hover:text-slate-200">
                {section.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{section.description}</p>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1" />
          </div>
          <div className="mt-4">
            <StatusBadge tone={section.tone}>{section.metric}</StatusBadge>
          </div>
        </Link>
      ))}
    </div>
  )
}
