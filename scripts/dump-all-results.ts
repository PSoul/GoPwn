import "dotenv/config"
import { prisma } from "@/lib/infra/prisma"

async function main() {
  const projects = await prisma.project.findMany({
    where: { lifecycle: { not: "idle" } },
    select: { id: true, name: true, lifecycle: true, currentRound: true, maxRounds: true },
  })

  for (const p of projects) {
    const findings = await prisma.finding.findMany({
      where: { projectId: p.id },
      select: { title: true, severity: true, status: true, affectedTarget: true },
      orderBy: { severity: "asc" },
    })

    const bySeverity: Record<string, number> = {}
    for (const f of findings) {
      bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1
    }

    console.log(`\n${"=".repeat(60)}`)
    console.log(`${p.name} [${p.lifecycle}] R${p.currentRound}/${p.maxRounds}`)
    console.log(`Findings: ${findings.length} (${Object.entries(bySeverity).map(([k, v]) => `${k}:${v}`).join(", ")})`)
    console.log(`${"=".repeat(60)}`)

    // Only show high/medium/low findings (skip info)
    const important = findings.filter(f => ["critical", "high", "medium", "low"].includes(f.severity))
    for (const f of important) {
      console.log(`  [${f.severity}] ${f.title} ${f.affectedTarget ? `→ ${f.affectedTarget}` : ""}`)
    }
    if (important.length === 0) {
      console.log("  (No high/medium/low findings)")
    }
    const infoCount = findings.filter(f => f.severity === "info").length
    if (infoCount > 0) {
      console.log(`  + ${infoCount} info-level findings`)
    }
  }

  await prisma.$disconnect()
}

main()
