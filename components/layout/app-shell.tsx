"use client"

import { usePathname } from "next/navigation"

import { AiChatWidget } from "@/components/layout/ai-chat-widget"
import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function AppShell({
  title,
  user,
  children,
}: {
  title?: string
  user?: { displayName: string; role: string }
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <SidebarProvider>
      <AppSidebar pathname={pathname ?? ""} />
      <SidebarInset>
        <AppHeader pathname={pathname ?? ""} title={title} user={user} />
        <div key={pathname} className="min-h-[calc(100svh-64px)] animate-fade-in bg-slate-50 px-4 py-6 dark:bg-slate-950 md:px-6">
          {children}
        </div>
      </SidebarInset>
      {user && <AiChatWidget />}
    </SidebarProvider>
  )
}
