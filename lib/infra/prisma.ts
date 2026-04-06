import { PrismaClient } from "@/lib/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createClient() {
  // pg.PoolConfig — limit connections to prevent pool exhaustion under high concurrency
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    max: 30,
    idleTimeoutMillis: 30_000,
  })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
