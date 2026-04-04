import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../lib/generated/prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" })
const prisma = new PrismaClient({ adapter })

const projectId = process.argv[2]
if (!projectId) {
  console.error("Usage: npx tsx scripts/reset-project.ts <projectId>")
  process.exit(1)
}

async function main() {
  // Delete in dependency order (children first)
  await prisma.poc.deleteMany({ where: { finding: { projectId } } })
  await prisma.finding.deleteMany({ where: { projectId } })
  await prisma.evidence.deleteMany({ where: { projectId } })
  await prisma.approval.deleteMany({ where: { projectId } })
  await prisma.fingerprint.deleteMany({ where: { asset: { projectId } } })
  await prisma.asset.deleteMany({ where: { projectId } })
  await prisma.orchestratorPlan.deleteMany({ where: { projectId } })
  await prisma.orchestratorRound.deleteMany({ where: { projectId } })
  await prisma.auditEvent.deleteMany({ where: { projectId } })
  await prisma.llmCallLog.deleteMany({ where: { projectId } })
  await prisma.mcpRun.deleteMany({ where: { projectId } })
  await prisma.project.update({
    where: { id: projectId },
    data: { lifecycle: "idle", currentRound: 0, currentPhase: "recon" },
  })
  console.log(`Project ${projectId} reset to idle`)
  await prisma.$disconnect()
}

main()
