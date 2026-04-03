import { localValidationRunSchema } from "@/lib/mcp/mcp-write-schema"
import { getStoredProjectById } from "@/lib/project/project-repository"
import { executeProjectLocalValidation } from "@/lib/orchestration/orchestrator-service"
import { withApiHandler } from "@/lib/infra/api-handler"

export const POST = withApiHandler(async (request, { params }) => {
  const { projectId } = await params
  const body = await request.json()
  const parsed = localValidationRunSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid local validation payload" }, { status: 400 })
  }

  const project = await getStoredProjectById(projectId)
  if (!project) {
    return Response.json({ error: `Project '${projectId}' or local lab not found` }, { status: 404 })
  }

  const payload = await executeProjectLocalValidation(projectId, parsed.data)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' or local lab not found` }, { status: 404 })
  }

  return Response.json(payload, { status: payload.status === "completed" ? 200 : 202 })
})
