import "dotenv/config"
import { createPgBossJobQueue } from "@/lib/infra/job-queue"
import { cleanupStale } from "@/lib/repositories/llm-log-repo"

async function main() {
  console.log("[worker] Starting worker process...")

  // Cleanup stale data from previous crashes
  const cleaned = await cleanupStale()
  if (cleaned.count > 0) {
    console.log(`[worker] Cleaned up ${cleaned.count} stale LLM call logs`)
  }

  const queue = createPgBossJobQueue()
  await queue.start()
  console.log("[worker] pg-boss started")

  // Register job handlers
  await queue.subscribe("plan_round", async (data) => {
    const { handlePlanRound } = await import("@/lib/workers/planning-worker")
    await handlePlanRound(data as { projectId: string; round: number })
  })

  await queue.subscribe("execute_tool", async (data) => {
    const { handleExecuteTool } = await import("@/lib/workers/execution-worker")
    await handleExecuteTool(data as { projectId: string; mcpRunId: string })
  })

  await queue.subscribe("analyze_result", async (data) => {
    const { handleAnalyzeResult } = await import("@/lib/workers/analysis-worker")
    await handleAnalyzeResult(data as { projectId: string; mcpRunId: string; rawOutput: string; toolName: string; target: string })
  })

  await queue.subscribe("verify_finding", async (data) => {
    const { handleVerifyFinding } = await import("@/lib/workers/verification-worker")
    await handleVerifyFinding(data as { projectId: string; findingId: string })
  })

  await queue.subscribe("round_completed", async (data) => {
    const { handleRoundCompleted } = await import("@/lib/workers/lifecycle-worker")
    await handleRoundCompleted(data as { projectId: string; round: number })
  })

  await queue.subscribe("settle_closure", async (data) => {
    const { handleSettleClosure } = await import("@/lib/workers/lifecycle-worker")
    await handleSettleClosure(data as { projectId: string })
  })

  console.log("[worker] All handlers registered. Waiting for jobs...")

  // Keep alive
  async function shutdown(signal: string) {
    console.log(`[worker] ${signal} received, shutting down...`)
    const { closeAll } = await import("@/lib/mcp/registry")
    await closeAll().catch((err) => console.error("[worker] Error closing MCP connectors:", err))
    await queue.stop()
    process.exit(0)
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err)
  process.exit(1)
})
