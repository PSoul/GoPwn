"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

type ProjectWorkspaceNavProps = {
  projectId: string
}

const tabs = [
  { href: "", label: "概览" },
  { href: "/results/domains", label: "域名 / Web" },
  { href: "/results/network", label: "IP / 端口 / 服务" },
  { href: "/results/findings", label: "漏洞与发现" },
  { href: "/context", label: "证据与日志" },
  { href: "/flow", label: "阶段流转" },
  { href: "/operations", label: "任务与调度" },
]

export function ProjectWorkspaceNav({ projectId }: ProjectWorkspaceNavProps) {
  const pathname = usePathname()

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const href = `/projects/${projectId}${tab.href}`
        const isActive = tab.href === "" ? pathname === href : pathname.startsWith(href)

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-full border px-4 py-2 text-sm transition-colors",
              isActive
                ? "border-slate-900 bg-slate-950 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950"
                : "border-slate-200 bg-white text-slate-600 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:text-white",
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
