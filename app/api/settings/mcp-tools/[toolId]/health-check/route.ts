import { runMcpHealthCheckPayload } from "@/lib/prototype-api"
import { withApiHandler } from "@/lib/api-handler"

export const POST = withApiHandler(async (_request, { params }) => {
  const { toolId } = await params
  const payload = await runMcpHealthCheckPayload(toolId)

  if (!payload) {
    return Response.json({ error: `MCP tool '${toolId}' not found` }, { status: 404 })
  }

  return Response.json({ tool: payload })
})
