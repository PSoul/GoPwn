import "dotenv/config"
import pg from "pg"

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  // Failed tasks
  const { rows: failed } = await client.query(
    `SELECT "toolName", "lastError", capability FROM scheduler_tasks WHERE "projectId" = $1 AND status = 'failed' ORDER BY "queuedAt"`,
    ["proj-20260401-cdf6296a"],
  )
  console.log("=== Failed Tasks ===")
  for (const t of failed) {
    console.log(`[${t.capability}] ${t.toolName} | ${(t.lastError || "").slice(0, 200)}`)
  }
  console.log(`Total failed: ${failed.length}`)

  // Also check MCP runs for errors
  const { rows: failedRuns } = await client.query(
    `SELECT "toolName", "errorMessage", "connectorMode" FROM mcp_runs WHERE "projectId" = $1 AND status = 'error' ORDER BY "createdAt" LIMIT 30`,
    ["proj-20260401-cdf6296a"],
  )
  console.log("\n=== Failed MCP Runs ===")
  for (const r of failedRuns) {
    console.log(`[${r.connectorMode}] ${r.toolName} | ${(r.errorMessage || "").slice(0, 200)}`)
  }
  console.log(`Total failed runs: ${failedRuns.length}`)

  // Round history
  const { rows: rounds } = await client.query(
    `SELECT round, "totalTasks", "newAssetCount", "newFindingCount", "newEvidenceCount" FROM orchestrator_rounds WHERE "projectId" = $1 ORDER BY round`,
    ["proj-20260401-cdf6296a"],
  )
  console.log("\n=== Round History ===")
  for (const r of rounds) {
    console.log(`Round ${r.round}: ${r.totalTasks} tasks, +${r.newAssetCount} assets, +${r.newFindingCount} findings, +${r.newEvidenceCount} evidence`)
  }

  // Task summary by status
  const { rows: statusCounts } = await client.query(
    `SELECT status, COUNT(*) as cnt FROM scheduler_tasks WHERE "projectId" = $1 GROUP BY status`,
    ["proj-20260401-cdf6296a"],
  )
  console.log("\n=== Task Status Summary ===")
  for (const s of statusCounts) {
    console.log(`${s.status}: ${s.cnt}`)
  }

  await client.end()
}

main().catch(console.error)
