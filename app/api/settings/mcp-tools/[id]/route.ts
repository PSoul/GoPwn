import { apiHandler, json } from "@/lib/infra/api-handler"
import { prisma } from "@/lib/infra/prisma"

export const PATCH = apiHandler(async (req, ctx) => {
  const { id } = await ctx.params
  const body = await req.json() as {
    enabled?: boolean
    requiresApproval?: boolean
    timeout?: number
    description?: string
  }

  const tool = await prisma.mcpTool.update({
    where: { id },
    data: body,
  })

  return json({ tool })
})
