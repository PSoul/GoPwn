import { mcpWorkflowSmokeSchema } from "@/lib/mcp-write-schema"
import { runProjectMcpWorkflowSmokePayload } from "@/lib/prototype-api"

type ProjectRouteContext = {
  params: Promise<{ projectId: string }>
}

export async function POST(request: Request, { params }: ProjectRouteContext) {
  const { projectId } = await params
  const body = await request.json()
  const parsed = mcpWorkflowSmokeSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid MCP workflow smoke payload" }, { status: 400 })
  }

  const payload = await runProjectMcpWorkflowSmokePayload(projectId, parsed.data)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  return Response.json(payload, { status: payload.status === "completed" ? 200 : 202 })
}
