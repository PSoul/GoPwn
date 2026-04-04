import { redirect } from "next/navigation"

import { requireAuth } from "@/lib/infra/auth"

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  await requireAuth()
  const { projectId } = await params
  redirect(`/projects/${projectId}`)
}
