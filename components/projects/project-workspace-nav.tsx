"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Globe, LayoutDashboard, ShieldAlert, Settings2, BrainCircuit } from "lucide-react"

import { cn } from "@/lib/utils"

type ProjectWorkspaceNavProps = {
  projectId: string
}

const tabs = [
  { href: "", label: "概览", icon: LayoutDashboard },
  { href: "/assets", label: "资产", icon: Globe },
  { href: "/findings", label: "漏洞", icon: ShieldAlert },
  { href: "/operations", label: "执行控制", icon: Settings2 },
  { href: "/ai-logs", label: "AI 日志", icon: BrainCircuit },
]

export function ProjectWorkspaceNav({ projectId }: ProjectWorkspaceNavProps) {
  const pathname = usePathname() ?? ""

  return (
    <nav role="tablist" aria-label="项目工作区" className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-px scrollbar-none dark:border-slate-800">
      {tabs.map((tab) => {
        const href = `/projects/${projectId}${tab.href}`
        const isActive = tab.href === "" ? pathname === href : pathname.startsWith(href)
        const Icon = tab.icon

        return (
          <Link
            key={href}
            href={href}
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
              isActive
                ? "border-slate-900 font-medium text-slate-900 dark:border-white dark:text-white"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
