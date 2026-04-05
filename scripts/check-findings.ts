import { prisma } from "@/lib/infra/prisma"
async function main() {
  const p = await prisma.project.findUnique({ where: { id: "cmnljpvjv000se8uyaex7ab4r" } })
  const assets = await prisma.asset.count({ where: { projectId: p!.id } })
  const findings = await prisma.finding.count({ where: { projectId: p!.id } })
  const runs = await prisma.mcpRun.count({ where: { projectId: p!.id } })
  console.log(JSON.stringify({ lifecycle: p!.lifecycle, round: p!.currentRound, phase: p!.currentPhase, assets, findings, runs }))
  const list = await prisma.finding.findMany({ where: { projectId: p!.id }, select: { title: true, severity: true, status: true, affectedTarget: true } })
  console.log("\n=== Findings ===")
  list.forEach(f => console.log(`[${f.severity}/${f.status}] ${f.title} → ${f.affectedTarget}`))
  await prisma.$disconnect()
}
main()
