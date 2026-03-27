import Link from "next/link"

import { settingsSections } from "@/lib/platform-config"
import { cn } from "@/lib/utils"

export function SettingsSubnav({ currentHref }: { currentHref: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/settings"
        className={cn(
          "rounded-full border px-4 py-2 text-sm transition-colors",
          currentHref === "/settings"
            ? "border-slate-900 bg-slate-950 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950"
            : "border-slate-200 bg-white text-slate-600 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:text-white",
        )}
      >
        设置中心
      </Link>
      {settingsSections.map((section) => (
        <Link
          key={section.href}
          href={section.href}
          className={cn(
            "rounded-full border px-4 py-2 text-sm transition-colors",
            currentHref === section.href
              ? "border-slate-900 bg-slate-950 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950"
              : "border-slate-200 bg-white text-slate-600 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:text-white",
          )}
        >
          {section.title}
        </Link>
      ))}
    </div>
  )
}
