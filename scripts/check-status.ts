import "dotenv/config"
import { prisma } from "@/lib/infra/prisma"

async function main() {
  const p = await prisma.project.findFirst({
    where: { id: "cmnkl4uhs0000bkuyebxsqm1r" },
    select: { id: true, name: true, lifecycle: true, currentPhase: true, currentRound: true, maxRounds: true, updatedAt: true },
  })
  console.log("Project:", JSON.stringify(p, null, 2))

  const runs = await prisma.mcpRun.groupBy({
    by: ["status"],
    where: { projectId: "cmnkl4uhs0000bkuyebxsqm1r" },
    _count: true,
  })
  console.log("Runs by status:", JSON.stringify(runs))

  const assets = await prisma.asset.count({ where: { projectId: "cmnkl4uhs0000bkuyebxsqm1r" } })
  const findings = await prisma.finding.count({ where: { projectId: "cmnkl4uhs0000bkuyebxsqm1r" } })
  console.log("Assets:", assets, "Findings:", findings)

  // Check recent LLM logs
  const recentLlm = await prisma.llmCallLog.findMany({
    where: { projectId: "cmnkl4uhs0000bkuyebxsqm1r" },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, role: true, status: true, error: true, createdAt: true },
  })
  console.log("Recent LLM calls:", JSON.stringify(recentLlm, null, 2))

  await prisma.$disconnect()
}

main()
