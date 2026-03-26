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
        <div className="min-h-[calc(100svh-89px)] bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_35%),linear-gradient(180deg,_rgba(248,250,252,0.96),_rgba(241,245,249,0.92))] px-4 py-6 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_30%),linear-gradient(180deg,_rgba(2,6,23,0.96),_rgba(15,23,42,0.95))] md:px-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
