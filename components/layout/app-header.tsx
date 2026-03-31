"use client"

import Link from "next/link"
import { Bell, ChevronRight } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { getNavigationTitle, getNavigationTrail } from "@/lib/navigation"

const roleLabels: Record<string, string> = {
  admin: "管理员",
  researcher: "研究员",
  approver: "审批员",
}

export function AppHeader({ pathname, title, user }: { pathname: string; title?: string; user?: { displayName: string; role: string } }) {
  const pageTitle = title ?? getNavigationTitle(pathname)
  const trail = getNavigationTrail(pathname)

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 dark:border-slate-800 dark:bg-slate-950/95">
      <div className="flex h-16 items-center justify-between px-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="rounded-md border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 md:hidden" />
          <nav className="flex min-w-0 items-center gap-1.5 text-sm">
            {trail.map((item, index) => (
              <div key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
                {index > 0 ? <ChevronRight className="h-4 w-4 text-slate-400" /> : null}
                {"href" in item && item.href ? (
                  <Link href={item.href} className="truncate text-slate-600 transition-colors hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
                    {item.label}
                  </Link>
                ) : (
                  <span className="truncate font-medium text-slate-950 dark:text-white">
                    {index === trail.length - 1 ? pageTitle : item.label}
                  </span>
                )}
              </div>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
            <Bell className="h-4 w-4" />
            <span className="sr-only">查看通知</span>
          </Button>
          <div className="rounded-full border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-950">
            <ThemeToggle />
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-950 sm:flex">
            <Avatar className="h-7 w-7 border border-slate-200 dark:border-slate-700">
              <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {user?.displayName?.charAt(0) ?? "用"}
              </AvatarFallback>
            </Avatar>
            <div className="leading-tight">
              <p className="text-xs font-medium text-slate-900 dark:text-white">{user?.displayName ?? "未登录"}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{roleLabels[user?.role ?? ""] ?? user?.role ?? ""}</p>
            </div>
          </div>
          <form action="/api/auth/logout" method="post">
            <Button variant="outline" size="sm" className="rounded-full">
              退出
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
