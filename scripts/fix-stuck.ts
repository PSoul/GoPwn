import "dotenv/config"
import { prisma } from "@/lib/infra/prisma"

async function main() {
  const result = await prisma.mcpRun.updateMany({
    where: {
      projectId: "cmnkl4uhs0000bkuyebxsqm1r",
      status: { in: ["pending", "scheduled", "running"] },
    },
    data: {
      status: "failed",
      error: "force-cleared: stuck after worker crash",
      completedAt: new Date(),
    },
  })
  console.log("Updated", result.count, "stuck runs")
  await prisma.$disconnect()
}

main()
