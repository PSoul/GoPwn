import { mcpToolPatchSchema } from "@/lib/mcp/mcp-write-schema"
import { getStoredMcpToolById, updateStoredMcpTool } from "@/lib/mcp/mcp-repository"
import { withApiHandler } from "@/lib/infra/api-handler"

export const GET = withApiHandler(async (_request, { params }) => {
  const { toolId } = await params
  const payload = await getStoredMcpToolById(toolId)

  if (!payload) {
    return Response.json({ error: `MCP tool '${toolId}' not found` }, { status: 404 })
  }

  return Response.json({ tool: payload })
})

export const PATCH = withApiHandler(async (request, { params }) => {
  const { toolId } = await params
  const body = await request.json()
  const parsed = mcpToolPatchSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid MCP tool patch payload" }, { status: 400 })
  }

  const payload = await updateStoredMcpTool(toolId, parsed.data)

  if (!payload) {
    return Response.json({ error: `MCP tool '${toolId}' not found` }, { status: 404 })
  }

  return Response.json({ tool: payload })
})
