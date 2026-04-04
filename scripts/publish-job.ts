import "dotenv/config"
import { prisma } from "../lib/infra/prisma"
import { createPgBossJobQueue } from "../lib/infra/job-queue"

const projectId = process.argv[2] ?? "cmnkc4cxd0000tguyn0si4ey1"

async function main() {
  // Ensure project is in planning state
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) {
    console.error("Project not found:", projectId)
    process.exit(1)
  }
  console.log("Project:", project.name, "| lifecycle:", project.lifecycle)

  if (project.lifecycle !== "planning") {
    await prisma.project.update({
      where: { id: projectId },
      data: { lifecycle: "planning", currentRound: 1, currentPhase: "recon" },
    })
    console.log("Updated to planning state")
  }

  const queue = createPgBossJobQueue()
  await queue.start()
  console.log("pg-boss started")

  const jobId = await queue.publish("plan_round", { projectId, round: 1 })
  console.log("Published plan_round job:", jobId)

  // Wait for pg-boss to flush
  await new Promise((r) => setTimeout(r, 3000))
  await queue.stop()
  await prisma.$disconnect()
  console.log("Done")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
