/**
 * E2E database seed script — resets database to a clean state and seeds
 * the minimum data needed for E2E tests (researcher user + LLM profiles).
 *
 * Usage: node scripts/e2e-seed-database.mjs
 *
 * Requires: DATABASE_URL environment variable (loaded from .env via dotenv)
 */

import "dotenv/config"
import pg from "pg"
import bcrypt from "bcryptjs"

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error("[E2E Seed] DATABASE_URL is not set.")
  process.exit(1)
}

const pool = new pg.Pool({ connectionString })

async function main() {
  const client = await pool.connect()

  try {
    console.log("[E2E Seed] Truncating all tables...")
    // Dynamically get all user tables to avoid hardcoded table name mismatch
    const tableResult = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
    `)
    const tables = tableResult.rows.map(r => `"${r.tablename}"`).join(", ")
    if (tables) {
      await client.query(`TRUNCATE TABLE ${tables} CASCADE`)
    }

    console.log("[E2E Seed] Seeding researcher user...")
    const passwordHash = bcrypt.hashSync("Prototype@2026", 10)
    const now = new Date()
    await client.query(`
      INSERT INTO users (id, account, password, "displayName", role, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO NOTHING
    `, [
      "user-seed-researcher",
      "researcher@company.local",
      passwordHash,
      "研究员席位 A",
      "researcher",
      now,
      now,
    ])

    console.log("[E2E Seed] Seeding default LLM profiles...")
    // Worker expects profile IDs: planner (also used by react), analyzer, reviewer
    const apiKey = process.env.LLM_API_KEY || ""
    const baseUrl = process.env.LLM_BASE_URL || ""
    const model = process.env.LLM_ORCHESTRATOR_MODEL || "gpt-4o"
    const profiles = [
      { id: "planner", provider: "openai-compatible", model },
      { id: "analyzer", provider: "openai-compatible", model },
      { id: "reviewer", provider: "openai-compatible", model },
    ]

    for (const p of profiles) {
      await client.query(`
        INSERT INTO llm_profiles (id, provider, "apiKey", "baseUrl", model, "timeoutMs", temperature)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
      `, [p.id, p.provider, apiKey, baseUrl, p.model, 120000, 0.2])
    }

    console.log("[E2E Seed] Database ready for E2E tests.")
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error("[E2E Seed] Failed:", error)
  process.exit(1)
})
