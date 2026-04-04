import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../lib/generated/prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" })
const prisma = new PrismaClient({ adapter })

async function main() {
  for (const role of ["planner", "analyzer", "reviewer"]) {
    await prisma.llmProfile.update({
      where: { id: role },
      data: {
        baseUrl: "https://api.claws.codes/v1",
        model: "gpt-5.3-codex",
        apiKey: "sk-vSYtzOiI89ttAgD0Q1RxiavjxFktEbbXeiKydczYrbbKYwdv",
      },
    })
    console.log("Updated " + role)
  }
  const all = await prisma.llmProfile.findMany()
  console.log(JSON.stringify(all.map(p => ({ id: p.id, model: p.model, baseUrl: p.baseUrl })), null, 2))
  await prisma.$disconnect()
}
main()
