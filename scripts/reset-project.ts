import { prisma } from "@/lib/infra/prisma"
async function main() {
  const id = process.argv[2] || "cmnljpvjv000se8uyaex7ab4r"
  await prisma.project.update({
    where: { id },
    data: { lifecycle: "idle", currentRound: 0 }
  })
  const deleted = await prisma.orchestratorRound.deleteMany({ where: { projectId: id } })
  console.log("Reset done, deleted rounds:", deleted.count)
  await prisma.$disconnect()
}
main()
