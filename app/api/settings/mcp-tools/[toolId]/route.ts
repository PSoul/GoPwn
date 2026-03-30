import { mcpToolPatchSchema } from "@/lib/mcp-write-schema"
import { getMcpToolPayload, updateMcpToolPayload } from "@/lib/prototype-api"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async (_request, { params }) => {
  const { toolId } = await params
  const payload = await getMcpToolPayload(toolId)

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

  const payload = await updateMcpToolPayload(toolId, parsed.data)

  if (!payload) {
    return Response.json({ error: `MCP tool '${toolId}' not found` }, { status: 404 })
  }

  return Response.json({ tool: payload })
})
