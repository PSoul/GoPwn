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
    await client.query(`
      TRUNCATE TABLE llm_call_logs, audit_logs, work_logs, orchestrator_rounds,
        orchestrator_plans, findings, evidence, assets, approvals, mcp_runs,
        scheduler_tasks, project_conclusions, project_scheduler_controls,
        project_form_presets, project_details, projects, mcp_tool_contracts,
        mcp_server_contracts, mcp_tools, llm_profiles, global_approval_control,
        approval_policies, scope_rules, users CASCADE
    `)

    console.log("[E2E Seed] Seeding researcher user...")
    const passwordHash = bcrypt.hashSync("Prototype@2026", 10)
    const now = new Date()
    await client.query(`
      INSERT INTO users (id, account, password, "displayName", role, status, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO NOTHING
    `, [
      "user-seed-researcher",
      "researcher@company.local",
      passwordHash,
      "研究员席位 A",
      "researcher",
      "active",
      now,
      now,
    ])

    console.log("[E2E Seed] Seeding default LLM profiles...")
    const profiles = [
      { id: "llm-orchestrator", provider: "openai-compatible", label: "编排模型", model: "gpt-4o", enabled: false },
      { id: "llm-reviewer", provider: "openai-compatible", label: "审阅模型", model: "gpt-4o-mini", enabled: false },
      { id: "llm-extractor", provider: "openai-compatible", label: "提取模型", model: "gpt-4o-mini", enabled: false },
    ]

    for (const p of profiles) {
      await client.query(`
        INSERT INTO llm_profiles (id, provider, label, "apiKey", "baseUrl", model, "timeoutMs", temperature, enabled)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
      `, [p.id, p.provider, p.label, "", "", p.model, 30000, 0.2, p.enabled])
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
