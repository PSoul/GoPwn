import { apiHandler, json } from "@/lib/infra/api-handler"
import { prisma } from "@/lib/infra/prisma"
import { callTool } from "@/lib/mcp/registry"

export const POST = apiHandler(async (_req, ctx) => {
  const { id } = await ctx.params

  const tool = await prisma.mcpTool.findUniqueOrThrow({ where: { id } })

  let healthy = true
  try {
    const result = await callTool(tool.toolName, { action: "health-check", target: "" })
    if (result.isError) healthy = false
  } catch {
    healthy = false
  }

  return json({ tool, healthy })
})
