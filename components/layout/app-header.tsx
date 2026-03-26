"use client"

import { Bell, Search } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { getNavigationTitle } from "@/lib/navigation"

export function AppHeader({ pathname, title }: { pathname: string; title?: string }) {
  const pageTitle = title ?? getNavigationTitle(pathname)

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 px-4 py-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/75 md:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <SidebarTrigger className="mt-1 rounded-full border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="info">单人研究员工作台</StatusBadge>
              <StatusBadge tone="warning">流程优先</StatusBadge>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-950 dark:text-white">{pageTitle}</h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">围绕项目推进、审批、证据与 MCP 控制构建的高保真原型。</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-[280px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="搜索项目、资产、审批单号..." className="h-11 rounded-full border-slate-200 bg-white pl-10 dark:border-slate-800 dark:bg-slate-950" />
          </div>
          <Button variant="outline" size="icon" className="h-11 w-11 rounded-full border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <Bell className="h-4 w-4" />
            <span className="sr-only">查看通知</span>
          </Button>
          <div className="rounded-full border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-950">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
