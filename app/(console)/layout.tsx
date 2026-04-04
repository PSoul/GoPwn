import { AppShell } from "@/components/layout/app-shell"
import { requireAuth } from "@/lib/infra/auth"

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let user: { displayName: string; role: string } | undefined

  try {
    const session = await requireAuth()
    user = { displayName: session.account, role: session.role }
  } catch {
    // middleware handles redirect — this is a safety net
  }

  return <AppShell user={user}>{children}</AppShell>
}
