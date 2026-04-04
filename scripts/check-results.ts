import "dotenv/config"
import { prisma } from "../lib/infra/prisma"

async function main() {
  const projectId = "cmnkc4cxd0000tguyn0si4ey1"
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  console.log("Project:", project?.lifecycle, "| Phase:", project?.currentPhase, "| Round:", project?.currentRound)

  const runs = await prisma.mcpRun.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } })
  const succeeded = runs.filter((r) => r.status === "succeeded")
  const failed = runs.filter((r) => r.status === "failed")
  console.log("MCP Runs:", runs.length, "| Succeeded:", succeeded.length, "| Failed:", failed.length)

  console.log("\n--- Succeeded runs ---")
  for (const r of succeeded) {
    console.log(" OK:", r.toolName, "→", r.target?.slice(0, 60), "|", (r.rawOutput?.slice(0, 150) ?? ""))
  }
  console.log("\n--- Failed runs (first 5) ---")
  for (const r of failed.slice(0, 5)) {
    console.log(" FAIL:", r.toolName, "→", r.target?.slice(0, 60), "|", (r.error?.slice(0, 100) ?? ""))
  }

  const assets = await prisma.asset.findMany({ where: { projectId } })
  console.log("\nAssets:", assets.length)
  for (const a of assets) console.log(" ", a.kind, "|", a.value, "|", a.label)

  const findings = await prisma.finding.findMany({ where: { projectId } })
  console.log("\nFindings:", findings.length)
  for (const f of findings) console.log(" ", f.severity, "|", f.title, "|", f.status)

  const evidence = await prisma.evidence.findMany({ where: { projectId } })
  console.log("\nEvidence:", evidence.length)
  for (const e of evidence) console.log(" ", e.toolName, "|", e.summary?.slice(0, 80))

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
