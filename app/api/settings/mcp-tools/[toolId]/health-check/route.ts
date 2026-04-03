import { runStoredMcpHealthCheck } from "@/lib/mcp/mcp-repository"
import { withApiHandler } from "@/lib/infra/api-handler"

export const POST = withApiHandler(async (_request, { params }) => {
  const { toolId } = await params
  const payload = await runStoredMcpHealthCheck(toolId)

  if (!payload) {
    return Response.json({ error: `MCP tool '${toolId}' not found` }, { status: 404 })
  }

  return Response.json({ tool: payload })
})
