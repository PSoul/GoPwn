import "dotenv/config"
import { prisma } from "@/lib/infra/prisma"

async function main() {
  const running = await prisma.mcpRun.findMany({
    where: { status: { in: ["running", "pending", "scheduled"] } },
    select: { id: true, projectId: true, toolName: true, target: true, status: true, createdAt: true, updatedAt: true },
  })
  console.log("Running/Pending runs:", JSON.stringify(running, null, 2))

  const streaming = await prisma.llmCallLog.findMany({
    where: { status: "streaming" },
    select: { id: true, projectId: true, role: true, status: true, createdAt: true },
  })
  console.log("Streaming LLM calls:", JSON.stringify(streaming, null, 2))

  await prisma.$disconnect()
}

main()
