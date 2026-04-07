import { redirect } from "next/navigation"

import { AppShell } from "@/components/layout/app-shell"
import { requireAuth } from "@/lib/infra/auth"

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let session
  try {
    session = await requireAuth()
  } catch {
    redirect("/login")
  }

  const user = { displayName: session.account, role: session.role }
  return <AppShell user={user}>{children}</AppShell>
}
