"use client"

import Link from "next/link"
import { ShieldCheck, Sparkles } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { getNavigationTitle, prototypeNavigation } from "@/lib/navigation"

export function AppSidebar({ pathname }: { pathname: string }) {
  return (
    <Sidebar collapsible="icon" variant="inset" className="border-r border-slate-200/70 dark:border-slate-800">
      <SidebarHeader className="px-4 py-4">
        <Link href="/dashboard" className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-600/25">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">授权外网安全评估平台</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">LLM 编排内核 · MCP 控制台</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel>主导航</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {prototypeNavigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title} className="h-11 rounded-2xl">
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <div className="flex min-w-0 flex-1 flex-col items-start group-data-[collapsible=icon]:hidden">
                          <span>{item.title}</span>
                          <span className="truncate text-[11px] font-normal text-slate-500 dark:text-slate-400">
                            {item.description}
                          </span>
                        </div>
                      </Link>
                    </SidebarMenuButton>
                    {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-sky-100 via-white to-white p-4 shadow-sm dark:border-slate-800 dark:from-sky-950/50 dark:via-slate-950 dark:to-slate-950">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-sky-600 dark:text-sky-300" />
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{getNavigationTitle(pathname)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="danger">6 个待审批动作</StatusBadge>
            <StatusBadge tone="warning">2 个阻塞项目</StatusBadge>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
