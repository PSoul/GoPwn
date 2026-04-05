import { prisma } from "@/lib/infra/prisma"
async function main() {
  const p = await prisma.project.findFirst({ orderBy: { createdAt: "desc" } })
  console.log(JSON.stringify({id: p?.id, name: p?.name, lifecycle: p?.lifecycle, round: p?.currentRound}))
  await prisma.$disconnect()
}
main()
