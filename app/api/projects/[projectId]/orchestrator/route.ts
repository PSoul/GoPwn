import { apiHandler, json } from "@/lib/infra/api-handler"
import { prisma } from "@/lib/infra/prisma"

export const GET = apiHandler(async (_req, ctx) => {
  const { projectId } = await ctx.params

  const [plans, rounds] = await Promise.all([
    prisma.orchestratorPlan.findMany({
      where: { projectId },
      orderBy: { round: "desc" },
    }),
    prisma.orchestratorRound.findMany({
      where: { projectId },
      orderBy: { round: "desc" },
    }),
  ])

  return json({ plans, rounds })
})
