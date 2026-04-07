import "dotenv/config"
import { prisma } from "@/lib/infra/prisma"

async function main() {
  const runResult = await prisma.mcpRun.updateMany({
    where: { status: { in: ["pending", "scheduled", "running"] } },
    data: { status: "failed", error: "force-cleared: global cleanup", completedAt: new Date() },
  })
  console.log("Cleared stuck runs:", runResult.count)

  const llmResult = await prisma.llmCallLog.updateMany({
    where: { status: "streaming" },
    data: { status: "failed", error: "force-cleared: stuck streaming" },
  })
  console.log("Cleared stuck LLM calls:", llmResult.count)

  await prisma.$disconnect()
}

main()
