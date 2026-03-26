import { mcpDispatchSchema } from "@/lib/mcp-write-schema"
import { dispatchProjectMcpRunPayload, listProjectMcpRunsPayload } from "@/lib/prototype-api"

type ProjectRouteContext = {
  params: Promise<{ projectId: string }>
}

export async function GET(_request: Request, { params }: ProjectRouteContext) {
  const { projectId } = await params
  const payload = listProjectMcpRunsPayload(projectId)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  return Response.json(payload)
}

export async function POST(request: Request, { params }: ProjectRouteContext) {
  const { projectId } = await params
  const body = await request.json()
  const parsed = mcpDispatchSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid MCP dispatch payload" }, { status: 400 })
  }

  const payload = dispatchProjectMcpRunPayload(projectId, parsed.data)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  return Response.json(payload, { status: payload.approval ? 202 : 200 })
}
