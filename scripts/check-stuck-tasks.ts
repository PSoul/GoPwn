import { prisma } from "@/lib/infra/prisma"

async function main() {
  const projectId = process.argv[2] || "proj-20260402-e07b7a76"

  const tasks = await prisma.schedulerTask.findMany({
    where: { projectId },
    orderBy: { queuedAt: "asc" },
  })

  console.log("Total tasks:", tasks.length)
  const byStatus: Record<string, number> = {}
  for (const t of tasks) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1
  }
  console.log("By status:", JSON.stringify(byStatus))

  const running = tasks.filter(t => t.status === "running")
  console.log("\nRunning tasks:")
  for (const t of running) {
    console.log(" ", t.id.slice(0, 30), "| toolName:", t.toolName, "| target:", t.target?.slice(0, 40), "| queued:", t.queuedAt)
  }

  const failed = tasks.filter(t => t.status === "failed")
  console.log("\nFailed tasks:")
  for (const t of failed) {
    console.log(" ", t.id.slice(0, 30), "| toolName:", t.toolName, "| lastError:", t.lastError?.slice(0, 80))
  }

  await prisma.$disconnect()
}

main()
