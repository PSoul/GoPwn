import { localValidationRunSchema } from "@/lib/mcp-write-schema"
import {
  generateProjectOrchestratorPlanPayload,
  getProjectOrchestratorPayload,
} from "@/lib/prototype-api"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async (_request, { params }) => {
  const { projectId } = await params
  const payload = await getProjectOrchestratorPayload(projectId)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  return Response.json(payload)
})

export const POST = withApiHandler(async (request, { params }) => {
  const { projectId } = await params
  const body = await request.json()
  const parsed = localValidationRunSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid orchestrator plan payload" }, { status: 400 })
  }

  const payload = await generateProjectOrchestratorPlanPayload(projectId, parsed.data)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' or local lab not found` }, { status: 404 })
  }

  return Response.json(payload)
})
