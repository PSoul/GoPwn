import { mcpToolPatchSchema } from "@/lib/mcp-write-schema"
import { getMcpToolPayload, updateMcpToolPayload } from "@/lib/prototype-api"

type McpToolRouteContext = {
  params: Promise<{ toolId: string }>
}

export async function GET(_request: Request, { params }: McpToolRouteContext) {
  const { toolId } = await params
  const payload = getMcpToolPayload(toolId)

  if (!payload) {
    return Response.json({ error: `MCP tool '${toolId}' not found` }, { status: 404 })
  }

  return Response.json({ tool: payload })
}

export async function PATCH(request: Request, { params }: McpToolRouteContext) {
  const { toolId } = await params
  const body = await request.json()
  const parsed = mcpToolPatchSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid MCP tool patch payload" }, { status: 400 })
  }

  const payload = updateMcpToolPayload(toolId, parsed.data)

  if (!payload) {
    return Response.json({ error: `MCP tool '${toolId}' not found` }, { status: 404 })
  }

  return Response.json({ tool: payload })
}
