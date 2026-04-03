import { mcpDispatchSchema } from "@/lib/mcp/mcp-write-schema"
import { dispatchProjectMcpRunAndDrain } from "@/lib/project/project-mcp-dispatch-service"
import { listStoredMcpRuns } from "@/lib/mcp/mcp-gateway-repository"
import { getStoredProjectById } from "@/lib/project/project-repository"
import { withApiHandler } from "@/lib/infra/api-handler"

export const GET = withApiHandler(async (_request, { params }) => {
  const { projectId } = await params
  const project = await getStoredProjectById(projectId)

  if (!project) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  const items = await listStoredMcpRuns(projectId)
  return Response.json({ items, total: items.length })
})

export const POST = withApiHandler(async (request, { params }) => {
  const { projectId } = await params
  const body = await request.json()
  const parsed = mcpDispatchSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid MCP dispatch payload" }, { status: 400 })
  }

  const payload = await dispatchProjectMcpRunAndDrain(projectId, parsed.data)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  return Response.json(payload, { status: payload.approval ? 202 : 200 })
})
