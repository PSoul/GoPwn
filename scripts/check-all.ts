import "dotenv/config"
import { prisma } from "@/lib/infra/prisma"

async function main() {
  const projects = await prisma.project.findMany({
    where: { lifecycle: { not: "idle" } },
    select: { id: true, name: true, lifecycle: true, currentPhase: true, currentRound: true, maxRounds: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  })

  for (const p of projects) {
    const assets = await prisma.asset.count({ where: { projectId: p.id } })
    const findings = await prisma.finding.count({ where: { projectId: p.id } })
    const runs = await prisma.mcpRun.groupBy({
      by: ["status"],
      where: { projectId: p.id },
      _count: true,
    })
    const runSummary = runs.map(r => `${r.status}:${r._count}`).join(" ")
    console.log(`[${p.lifecycle}] ${p.name} R${p.currentRound}/${p.maxRounds} | assets:${assets} findings:${findings} | runs: ${runSummary}`)
  }

  await prisma.$disconnect()
}

main()
