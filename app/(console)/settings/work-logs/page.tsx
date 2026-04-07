import { redirect } from "next/navigation"

export default async function WorkLogsSettingsPage() {
  redirect("/settings/audit-logs")
}
