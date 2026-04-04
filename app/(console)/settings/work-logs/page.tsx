import { redirect } from "next/navigation"

import { requireAuth } from "@/lib/infra/auth"

export default async function WorkLogsSettingsPage() {
  await requireAuth()
  redirect("/settings/audit-logs")
}
