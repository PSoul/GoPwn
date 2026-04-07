import "dotenv/config"
import { prisma } from "@/lib/infra/prisma"

async function main() {
  // Force-clear stuck MCP runs
  const runResult = await prisma.mcpRun.updateMany({
    where: {
      projectId: "cmnkl4uhs0000bkuyebxsqm1r",
      status: { in: ["pending", "scheduled", "running"] },
    },
    data: {
      status: "failed",
      error: "force-cleared: stuck after timeout",
      completedAt: new Date(),
    },
  })
  console.log("Cleared stuck runs:", runResult.count)

  // Force-clear stuck streaming LLM calls
  const llmResult = await prisma.llmCallLog.updateMany({
    where: {
      projectId: "cmnkl4uhs0000bkuyebxsqm1r",
      status: "streaming",
    },
    data: {
      status: "failed",
      error: "force-cleared: stuck streaming",
    },
  })
  console.log("Cleared stuck LLM calls:", llmResult.count)

  await prisma.$disconnect()
}

main()
