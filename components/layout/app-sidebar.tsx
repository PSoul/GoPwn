"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { apiFetch } from "@/lib/infra/api-client"
import { prototypeNavigation } from "@/lib/infra/navigation"

export function AppSidebar({ pathname }: { pathname: string }) {
  const [dynamicBadges, setDynamicBadges] = useState<Record<string, string>>({})

  useEffect(() => {
    const controller = new AbortController()

    async function loadBadges() {
      try {
        const payload = await apiFetch<{
          projectCount?: number
          totalProjects?: number
        }>("/api/dashboard", { signal: controller.signal })

        const total = payload.projectCount ?? payload.totalProjects ?? 0
        setDynamicBadges({
          "/projects": total > 0 ? String(total) : "",
        })
      } catch {
        // ignore sidebar badge refresh failures and fall back to no badges
      }
    }

    void loadBadges()

    return () => controller.abort()
  }, [pathname])

  const groups = [
    { label: "总览", items: prototypeNavigation.filter((item) => item.section === "总览") },
    { label: "发现", items: prototypeNavigation.filter((item) => item.section === "发现") },
    { label: "系统", items: prototypeNavigation.filter((item) => item.section === "系统") },
  ]

  return (
    <Sidebar collapsible="offcanvas" variant="sidebar" className="border-r border-slate-200/80 dark:border-slate-800">
      <SidebarHeader className="h-16 justify-center border-b border-slate-200/80 px-6 py-0 dark:border-slate-800">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-slate-950 dark:text-white">GoPwn</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Penetration Testing Platform</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-4 py-5">
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="px-0 py-0">
            <SidebarGroupLabel className="mb-2 px-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  const badge = dynamicBadges[item.href] ?? item.badge

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                        className="h-10 rounded-md px-3 text-[15px] font-medium data-[active=true]:bg-slate-100 data-[active=true]:text-slate-950 dark:data-[active=true]:bg-slate-800 dark:data-[active=true]:text-white"
                      >
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {badge ? (
                        <SidebarMenuBadge className="right-2 rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {badge}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
