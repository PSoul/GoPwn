/**
 * Prisma seed script — creates default data for v2 schema.
 *
 * Usage:
 *   1. Start PostgreSQL: docker compose up db -d
 *   2. Apply schema: npx prisma db push
 *   3. Run seed: npx tsx prisma/seed.ts
 */

import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../lib/generated/prisma/client"
import { hash } from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding v2 database...")

  // Default admin user
  const passwordHash = await hash("Prototype@2026", 10)
  await prisma.user.upsert({
    where: { account: "admin@company.local" },
    update: {},
    create: {
      account: "admin@company.local",
      password: passwordHash,
      displayName: "管理员",
      role: "admin",
    },
  })
  console.log("  ✓ Default admin user (admin@company.local / Prototype@2026)")

  // Default LLM profiles (empty — user configures in settings)
  for (const role of ["planner", "analyzer", "reviewer"]) {
    await prisma.llmProfile.upsert({
      where: { id: role },
      update: {},
      create: {
        id: role,
        provider: "openai-compatible",
        apiKey: "",
        baseUrl: "",
        model: "",
        timeoutMs: 120000,
        temperature: 0.2,
      },
    })
  }
  console.log("  ✓ LLM profiles (planner, analyzer, reviewer)")

  // Default global config
  await prisma.globalConfig.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      approvalEnabled: true,
      autoApproveLowRisk: true,
      autoApproveMediumRisk: true,
    },
  })
  console.log("  ✓ Global config")

  console.log("\nSeed complete!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
