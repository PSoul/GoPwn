import { runMcpHealthCheckPayload } from "@/lib/prototype-api"

type McpToolHealthRouteContext = {
  params: Promise<{ toolId: string }>
}

export async function POST(_request: Request, { params }: McpToolHealthRouteContext) {
  const { toolId } = await params
  const payload = runMcpHealthCheckPayload(toolId)

  if (!payload) {
    return Response.json({ error: `MCP tool '${toolId}' not found` }, { status: 404 })
  }

  return Response.json({ tool: payload })
}
