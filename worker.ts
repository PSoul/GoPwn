import "dotenv/config"
import { createPgBossJobQueue, type JobQueue } from "@/lib/infra/job-queue"
import { cleanupStale } from "@/lib/repositories/llm-log-repo"
import { bootstrapMcp } from "@/lib/services/mcp-bootstrap"
import { logger } from "@/lib/infra/logger"
import * as projectRepo from "@/lib/repositories/project-repo"
import * as mcpRunRepo from "@/lib/repositories/mcp-run-repo"
import { createPipelineLogger } from "@/lib/infra/pipeline-logger"

async function recoverStaleProjects(queue: JobQueue) {
  const staleStates = ["planning", "executing", "reviewing", "settling"] as const
  const staleProjects = await projectRepo.findByLifecycles(staleStates)

  if (staleProjects.length === 0) return

  logger.info({ count: staleProjects.length }, "found stale projects, attempting recovery")

  for (const project of staleProjects) {
    const log = createPipelineLogger(project.id, "recovery")

    switch (project.lifecycle) {
      case "planning":
        log.warn("stale_recovery", `恢复卡死项目: planning → 重新发起第 ${project.currentRound + 1} 轮 ReAct`)
        await queue.publish("react_round", {
          projectId: project.id,
          round: project.currentRound + 1,
        }, { expireInSeconds: 1800 })
        break

      case "executing": {
        // Force-fail any runs stuck in "running" for too long (>10 min)
        const forceFailed = await mcpRunRepo.failStaleRunningRuns(project.id, 10 * 60 * 1000)
        if (forceFailed > 0) {
          log.warn("stale_recovery", `强制终止 ${forceFailed} 个超时 running run`)
        }

        const pending = await mcpRunRepo.countPendingByProject(project.id)
        if (pending === 0) {
          // No pending runs — ReAct loop may have finished but round_completed lost
          log.warn("stale_recovery", `恢复卡死项目: executing → 无 pending run，触发轮次审阅`)
          await queue.publish("round_completed", {
            projectId: project.id,
            round: project.currentRound,
          }, { singletonKey: `round-complete-${project.id}-${project.currentRound}` })
        } else {
          // ReAct loop crashed mid-execution — re-publish react_round
          log.warn("stale_recovery", `恢复卡死项目: executing → 重新发起第 ${project.currentRound} 轮 ReAct`)
          await queue.publish("react_round", {
            projectId: project.id,
            round: project.currentRound,
          }, {
            expireInSeconds: 1800,
            singletonKey: `react-round-${project.id}-${project.currentRound}`,
          })
        }
        break
      }

      case "reviewing":
        log.warn("stale_recovery", `恢复卡死项目: reviewing → 重新触发轮次审阅`)
        await queue.publish("round_completed", {
          projectId: project.id,
          round: project.currentRound,
        }, { singletonKey: `round-complete-${project.id}-${project.currentRound}` })
        break

      case "settling":
        log.warn("stale_recovery", `恢复卡死项目: settling → 重新触发结算`)
        await queue.publish("settle_closure", { projectId: project.id })
        break
    }
  }
}

async function main() {
  logger.info("starting worker process")

  // Cleanup stale data from previous crashes
  const cleaned = await cleanupStale()
  if (cleaned.count > 0) {
    logger.info({ cleaned: cleaned.count }, "cleaned stale LLM call logs")
  }

  // Bootstrap MCP: load servers from manifest and discover tools
  const mcp = await bootstrapMcp()
  logger.info({ servers: mcp.servers.loaded, tools: mcp.tools.synced }, "MCP bootstrap complete")

  const queue = createPgBossJobQueue()
  await queue.start()

  // Prevent unhandled pg-boss errors from crashing the worker
  const { getBoss } = await import("@/lib/infra/job-queue")
  const boss = getBoss()
  boss.on("error", (err: Error) => {
    logger.error({ err: err.message }, "pg-boss error (non-fatal)")
  })

  logger.info("pg-boss started")

  // Register job handlers
  await queue.subscribe("react_round", async (data) => {
    const { handleReactRound } = await import("@/lib/workers/react-worker")
    await handleReactRound(data as { projectId: string; round: number })
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

  logger.info("all handlers registered, waiting for jobs")

  // Recover stale projects from previous crashes
  await recoverStaleProjects(queue)

  // Periodic stale project recovery (every 5 minutes)
  const staleInterval = setInterval(async () => {
    try {
      await recoverStaleProjects(queue)
    } catch (err) {
      logger.error({ err }, "periodic stale recovery failed")
    }
  }, 5 * 60 * 1000)

  // Keep alive
  async function shutdown(signal: string) {
    logger.info({ signal }, "shutting down")
    clearInterval(staleInterval)
    const { closeAll } = await import("@/lib/mcp/registry")
    await closeAll().catch((err) => logger.error({ err }, "error closing MCP connectors"))
    await queue.stop()
    process.exit(0)
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))
}

main().catch((err) => {
  logger.fatal({ err }, "fatal error")
  process.exit(1)
})
