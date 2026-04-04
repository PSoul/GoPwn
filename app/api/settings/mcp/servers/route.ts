import { apiHandler, json } from "@/lib/infra/api-handler"
import * as mcpToolRepo from "@/lib/repositories/mcp-tool-repo"

export const GET = apiHandler(async () => {
  const servers = await mcpToolRepo.findAllServers()
  const tools = await mcpToolRepo.findAll()
  return json({ servers, tools })
})

export const POST = apiHandler(async (req) => {
  const body = (await req.json()) as {
    serverName: string
    transport: string
    command?: string
    args?: string[]
    cwd?: string
    env?: Record<string, string>
    endpoint?: string
  }

  const server = await mcpToolRepo.upsertServer({
    serverName: body.serverName,
    transport: body.transport,
    command: body.command,
    args: body.args,
    cwd: body.cwd,
    envJson: body.env ? JSON.stringify(body.env) : undefined,
    endpoint: body.endpoint,
  })

  return json(server, 201)
})
