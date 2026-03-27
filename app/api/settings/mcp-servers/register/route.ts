import { mcpServerRegistrationSchema } from "@/lib/mcp-registration-schema"
import { registerMcpServerPayload } from "@/lib/prototype-api"

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = mcpServerRegistrationSchema.safeParse(body)

  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const errorMessage = issue ? `${issue.path.join(".") || "payload"}: ${issue.message}` : "Invalid MCP registration payload"
    return Response.json({ error: errorMessage }, { status: 400 })
  }

  const payload = registerMcpServerPayload(parsed.data)

  return Response.json(payload, { status: 201 })
}
