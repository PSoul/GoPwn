import "dotenv/config"
import { prisma } from "@/lib/infra/prisma"

async function main() {
  const profiles = await prisma.llmProfile.findMany()
  console.log("LLM Profiles:", JSON.stringify(profiles, null, 2))
  await prisma.$disconnect()
}

main()
