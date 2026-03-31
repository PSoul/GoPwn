import { cookies } from "next/headers"

import { AppShell } from "@/components/layout/app-shell"
import { readSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth-session"

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value
  const session = await readSessionToken(token)
  const user = session ? { displayName: session.displayName, role: session.role } : undefined

  return <AppShell user={user}>{children}</AppShell>
}
