/**
 * PGlite + Prisma integration for integration tests.
 *
 * Creates an in-memory PostgreSQL instance via PGlite, applies the schema DDL,
 * and returns a real PrismaClient connected to it through PGLiteSocketServer + pg.Pool.
 */

import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import pg from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/lib/generated/prisma"
import fs from "fs"
import path from "path"

export async function createTestDb() {
  // 1. Start PGlite in-memory
  const pglite = new PGlite()
  await pglite.waitReady

  // 2. Start socket server on random port
  const server = new PGLiteSocketServer({ db: pglite, port: 0 })
  await server.start()
  const port = (server as unknown as { port: number }).port
  if (typeof port !== "number" || port === 0) {
    throw new Error("Failed to get PGLiteSocketServer port")
  }

  // 3. Apply schema DDL
  const ddl = fs.readFileSync(
    path.join(__dirname, "schema.sql"),
    "utf-8",
  )
  await pglite.exec(ddl)

  // 4. Create pg.Pool → PrismaPg → PrismaClient
  const pool = new pg.Pool({
    host: "127.0.0.1",
    port,
    database: "template1",
    max: 1,
    idleTimeoutMillis: 0,
  })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  // 5. Collect table names for truncation
  const result = await pglite.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
  )
  const tableNames = result.rows
    .map((r) => r.tablename)
    .filter((t) => !t.startsWith("_prisma"))

  return {
    prisma,

    async truncateAll() {
      if (tableNames.length > 0) {
        await pglite.exec(
          `TRUNCATE ${tableNames.map((t) => `"${t}"`).join(", ")} CASCADE`,
        )
      }
    },

    async cleanup() {
      await prisma.$disconnect()
      await pool.end()
      await server.stop()
      await pglite.close()
    },
  }
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>
