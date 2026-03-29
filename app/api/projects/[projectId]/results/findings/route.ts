import { z } from "zod"

import { getProjectFindingsPayload } from "@/lib/prototype-api"
import { listStoredProjectFindings, upsertStoredProjectFindings } from "@/lib/project-results-repository"
import { withApiHandler } from "@/lib/api-handler"

const findingStatusSchema = z.object({
  findingId: z.string(),
  status: z.enum(["待验证", "已确认", "待复核", "已缓解"]),
})

export const GET = withApiHandler(async (_request, { params }) => {
  const { projectId } = await params
  const payload = getProjectFindingsPayload(projectId)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  return Response.json(payload)
})

export const PATCH = withApiHandler(async (request, { params }) => {
  const { projectId } = await params
  const body = await request.json()
  const parsed = findingStatusSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 })
  }

  const findings = listStoredProjectFindings(projectId)
  const target = findings.find((f) => f.id === parsed.data.findingId)

  if (!target) {
    return Response.json({ error: "Finding not found" }, { status: 404 })
  }

  const updated = { ...target, status: parsed.data.status, updatedAt: new Date().toISOString().slice(0, 16).replace("T", " ") }
  upsertStoredProjectFindings([updated])

  return Response.json({ finding: updated })
})
