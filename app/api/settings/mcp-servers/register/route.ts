import { mcpServerRegistrationSchema } from "@/lib/mcp-registration-schema"
import { registerStoredMcpServer } from "@/lib/mcp-server-repository"
import { withApiHandler } from "@/lib/api-handler"

export const POST = withApiHandler(async (request) => {
  const body = await request.json()
  const parsed = mcpServerRegistrationSchema.safeParse(body)

  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const errorMessage = issue ? `${issue.path.join(".") || "payload"}: ${issue.message}` : "Invalid MCP registration payload"
    return Response.json({ error: errorMessage }, { status: 400 })
  }

  const payload = await registerStoredMcpServer(parsed.data)

  return Response.json(payload, { status: 201 })
})
