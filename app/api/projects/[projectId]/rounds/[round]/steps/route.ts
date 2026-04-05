import { apiHandler, json } from "@/lib/infra/api-handler"
import { prisma } from "@/lib/infra/prisma"

export const GET = apiHandler(async (_req, ctx) => {
  const { projectId, round } = await ctx.params
  const roundNum = parseInt(round, 10)

  if (isNaN(roundNum) || roundNum < 1) {
    return json({ error: "Invalid round number" }, 400)
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  })
  if (!project) {
    return json({ error: "Project not found" }, 404)
  }

  const steps = await prisma.mcpRun.findMany({
    where: { projectId, round: roundNum },
    orderBy: [
      { stepIndex: { sort: "asc", nulls: "last" } },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      stepIndex: true,
      thought: true,
      functionArgs: true,
      toolName: true,
      capability: true,
      target: true,
      requestedAction: true,
      status: true,
      riskLevel: true,
      phase: true,
      round: true,
      rawOutput: true,
      error: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
  })

  const roundMeta = await prisma.orchestratorRound.findUnique({
    where: { projectId_round: { projectId, round: roundNum } },
  })

  return json({
    round: roundNum,
    meta: roundMeta
      ? {
          phase: roundMeta.phase,
          status: roundMeta.status,
          maxSteps: roundMeta.maxSteps,
          actualSteps: roundMeta.actualSteps,
          stopReason: roundMeta.stopReason,
          newAssetCount: roundMeta.newAssetCount,
          newFindingCount: roundMeta.newFindingCount,
          startedAt: roundMeta.startedAt,
          completedAt: roundMeta.completedAt,
        }
      : null,
    steps,
  })
})
