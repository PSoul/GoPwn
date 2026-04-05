/**
 * Execution worker — handles "execute_tool" jobs.
 * Calls the MCP tool and queues result analysis.
 */

import * as projectRepo from "@/lib/repositories/project-repo"
import * as mcpRunRepo from "@/lib/repositories/mcp-run-repo"
import { publishEvent } from "@/lib/infra/event-bus"
import { createPgBossJobQueue } from "@/lib/infra/job-queue"
import { createPipelineLogger } from "@/lib/infra/pipeline-logger"
import { callTool } from "@/lib/mcp"
import { buildToolInput } from "@/lib/llm/tool-input-mapper"

/** Max execution time per tool (5 minutes). Prevents runaway tools. */
const TOOL_TIMEOUT_MS = 5 * 60 * 1000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tool execution timeout after ${ms}ms: ${label}`)), ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

export async function handleExecuteTool(data: { projectId: string; mcpRunId: string }) {
  const { projectId, mcpRunId } = data
  let log = createPipelineLogger(projectId, "execute_tool")
  log.info("started", `执行工具 run ${mcpRunId}`)

  const mcpRun = await mcpRunRepo.findById(mcpRunId)
  if (!mcpRun) {
    log.error("failed", `McpRun ${mcpRunId} 不存在`)
    return
  }

  // Re-create logger with round info
  log = createPipelineLogger(projectId, "execute_tool", { round: mcpRun.round })

  // Check project is still active
  const project = await projectRepo.findById(projectId)
  if (!project || project.lifecycle === "stopped" || project.lifecycle === "stopping") {
    log.warn("cancelled", `项目已 ${project?.lifecycle ?? "deleted"}，取消执行`)
    await mcpRunRepo.updateStatus(mcpRunId, "cancelled")
    return
  }

  // Mark as running
  await mcpRunRepo.updateStatus(mcpRunId, "running", { startedAt: new Date() })

  await publishEvent({
    type: "tool_started",
    projectId,
    timestamp: new Date().toISOString(),
    data: { mcpRunId, toolName: mcpRun.toolName, target: mcpRun.target },
  })

  try {
    // Build tool input from the requested action
    const input = await buildToolInput(mcpRun.toolName, mcpRun.target, mcpRun.requestedAction)

    const timer = log.startTimer()
    log.info("mcp_call", `调用 ${mcpRun.toolName}(${mcpRun.target})`, { input })

    // Call the MCP tool with timeout protection
    const result = await withTimeout(
      callTool(mcpRun.toolName, input),
      TOOL_TIMEOUT_MS,
      `${mcpRun.toolName}(${mcpRun.target})`,
    )

    if (result.isError) {
      await mcpRunRepo.updateStatus(mcpRunId, "failed", {
        rawOutput: result.content,
        error: result.content.slice(0, 1000),
        completedAt: new Date(),
      })

      log.warn("mcp_response", `工具返回错误`, { error: result.content.slice(0, 500) })

      await publishEvent({
        type: "tool_failed",
        projectId,
        timestamp: new Date().toISOString(),
        data: { mcpRunId, toolName: mcpRun.toolName, error: result.content.slice(0, 500) },
      })

      // Tool errors are execution failures, not security findings — skip analysis
    } else {
      // Success — save output and queue analysis
      await mcpRunRepo.updateStatus(mcpRunId, "succeeded", {
        rawOutput: result.content,
        completedAt: new Date(),
      })

      log.info("mcp_response", `工具返回 ${result.content.length} 字符`, { durationMs: result.durationMs }, timer.elapsed())

      await publishEvent({
        type: "tool_completed",
        projectId,
        timestamp: new Date().toISOString(),
        data: {
          mcpRunId,
          toolName: mcpRun.toolName,
          target: mcpRun.target,
          outputLength: result.content.length,
          durationMs: result.durationMs,
        },
      })

      // Queue analysis
      const queue = createPgBossJobQueue()
      await queue.publish("analyze_result", {
        projectId,
        mcpRunId,
        rawOutput: result.content,
        toolName: mcpRun.toolName,
        target: mcpRun.target,
      })
    }

    // Check if all runs in this round are complete
    await checkRoundCompletion(projectId, mcpRun.round, log)

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error("failed", `执行失败: ${message}`, { error: message })

    await mcpRunRepo.updateStatus(mcpRunId, "failed", {
      error: message.slice(0, 1000),
      completedAt: new Date(),
    })

    await publishEvent({
      type: "tool_failed",
      projectId,
      timestamp: new Date().toISOString(),
      data: { mcpRunId, toolName: mcpRun.toolName, error: message.slice(0, 500) },
    })

    // Don't throw — MCP tools have side effects, should not auto-retry
    await checkRoundCompletion(projectId, mcpRun.round, log)
  }
}

// buildToolInput extracted to lib/llm/tool-input-mapper.ts

/**
 * Check if all runs in a round are complete and queue round_completed if so.
 * Uses startAfter delay to allow analysis jobs to finish before review.
 */
async function checkRoundCompletion(projectId: string, round: number, log: ReturnType<typeof createPipelineLogger>) {
  const runs = await mcpRunRepo.findByProjectAndRound(projectId, round)
  const terminal = ["succeeded", "failed", "cancelled"]
  const allDone = runs.length > 0 && runs.every((r) => terminal.includes(r.status))

  if (allDone) {
    log.info("round_check", `第 ${round} 轮全部 ${runs.length} 个 run 完成`)
    const queue = createPgBossJobQueue()
    // Delay round_completed by 30s to let analysis/verification jobs finish
    const startAfter = new Date(Date.now() + 30_000)
    await queue.publish("round_completed", { projectId, round }, {
      singletonKey: `round-complete-${projectId}-${round}`,
      startAfter: startAfter.toISOString(),
    })
  }
}
