import { z } from "zod"

import { getStoredProjectById } from "@/lib/project/project-repository"
import { listStoredProjectFindings, upsertStoredProjectFindings } from "@/lib/project/project-results-repository"
import { withApiHandler } from "@/lib/infra/api-handler"

const findingStatusSchema = z.object({
  findingId: z.string(),
  status: z.enum(["待验证", "已确认", "待复核", "已缓解"]),
})

export const GET = withApiHandler(async (_request, { params }) => {
  const { projectId } = await params
  const project = await getStoredProjectById(projectId)
  if (!project) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }
  const findings = await listStoredProjectFindings(projectId)

  return Response.json({ project, findings })
})

export const PATCH = withApiHandler(async (request, { params }) => {
  const { projectId } = await params
  const body = await request.json()
  const parsed = findingStatusSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 })
  }

  const findings = await listStoredProjectFindings(projectId)
  const target = findings.find((f) => f.id === parsed.data.findingId)

  if (!target) {
    return Response.json({ error: "Finding not found" }, { status: 404 })
  }

  const updated = { ...target, status: parsed.data.status, updatedAt: new Date().toISOString().slice(0, 16).replace("T", " ") }
  await upsertStoredProjectFindings([updated])

  return Response.json({ finding: updated })
})
