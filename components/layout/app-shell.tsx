"use client"

import { usePathname } from "next/navigation"

import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function AppShell({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <SidebarProvider>
      <AppSidebar pathname={pathname} />
      <SidebarInset>
        <AppHeader pathname={pathname} title={title} />
        <div className="min-h-[calc(100svh-64px)] bg-slate-50 px-4 py-6 dark:bg-slate-950 md:px-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
