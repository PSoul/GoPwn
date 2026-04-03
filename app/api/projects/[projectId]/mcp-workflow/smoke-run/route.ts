import { mcpWorkflowSmokeSchema } from "@/lib/mcp/mcp-write-schema"
import { runProjectSmokeWorkflow } from "@/lib/mcp/mcp-workflow-service"
import { withApiHandler } from "@/lib/infra/api-handler"

export const POST = withApiHandler(async (request, { params }) => {
  const { projectId } = await params
  const body = await request.json()
  const parsed = mcpWorkflowSmokeSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid MCP workflow smoke payload" }, { status: 400 })
  }

  const payload = await runProjectSmokeWorkflow(projectId, parsed.data.scenario)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  return Response.json(payload, { status: payload.status === "completed" ? 200 : 202 })
})
