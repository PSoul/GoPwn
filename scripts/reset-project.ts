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
  await prisma.orchestratorRound.deleteMany({ where: { projectId } })
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
