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

/**
 * Build MCP tool input from the action description and tool schema.
 * Parses the tool's inputSchema to map target/action to expected parameter names and types.
 */
async function buildToolInput(toolName: string, target: string, action: string): Promise<Record<string, unknown>> {
  const { findByToolName } = await import("@/lib/repositories/mcp-tool-repo")
  const tool = await findByToolName(toolName)
  const schema = (tool?.inputSchema ?? {}) as Record<string, unknown>
  const properties = (schema.properties ?? {}) as Record<string, { type?: string; items?: unknown }>
  const propNames = Object.keys(properties)

  if (propNames.length === 0) {
    return { target, action }
  }

  const input: Record<string, unknown> = {}
  const parsed = parseTarget(target)

  for (const name of propNames) {
    const propSchema = properties[name]
    const propType = propSchema?.type

    // Array properties (e.g. httpx targets: string[])
    if (propType === "array") {
      if (TARGET_PARAM_NAMES.has(name)) {
        input[name] = parsed.targets
      }
      continue
    }

    if (TARGET_PARAM_NAMES.has(name)) {
      input[name] = target
    } else if (HOST_PARAM_NAMES.has(name)) {
      input[name] = parsed.host
    } else if (name === "port" || name === "ports") {
      if (parsed.port == null) continue
      input[name] = propType === "number" ? parsed.port : String(parsed.port)
    } else if (name === "rawRequest") {
      // http_raw_request requires a full HTTP request string
      // If action looks like a raw HTTP request, use it; otherwise construct one
      if (action && (action.startsWith("GET ") || action.startsWith("POST ") || action.startsWith("HEAD "))) {
        input[name] = action
      } else {
        const parsedUrl = target.startsWith("http") ? new URL(target) : null
        const path = parsedUrl?.pathname ?? "/"
        const host = parsedUrl?.host ?? target
        input[name] = `GET ${path} HTTP/1.1\r\nHost: ${host}\r\n\r\n`
      }
    } else if (ACTION_PARAM_NAMES.has(name)) {
      input[name] = action
    } else if (name === "query") {
      input[name] = action || target
    } else if (name === "code") {
      input[name] = action
    } else if (name === "language") {
      input[name] = "javascript"
    }
    // Skip optional params (threads, timeout, noPing) — let tool defaults apply
  }

  return input
}

const TARGET_PARAM_NAMES = new Set(["target", "targets", "url", "endpoint", "address"])
const HOST_PARAM_NAMES = new Set(["host", "hostname", "domain"])
const ACTION_PARAM_NAMES = new Set(["action", "command", "description"])

type ParsedTarget = { host: string; port: number | null; targets: string[] }

/** Parse a target string into host, port, and array forms */
function parseTarget(target: string): ParsedTarget {
  // URL format (e.g. "http://127.0.0.1:8080/path")
  try {
    const url = new URL(target)
    return {
      host: url.hostname,
      port: url.port ? parseInt(url.port, 10) : null,
      targets: [target],
    }
  } catch {
    // Not a URL — continue
  }

  // host:port format (e.g. "127.0.0.1:8080")
  const match = target.match(/^([^:]+):(\d+)$/)
  if (match) {
    return {
      host: match[1],
      port: parseInt(match[2], 10),
      targets: [target],
    }
  }

  // Comma-separated list (e.g. "http://a.com, http://b.com")
  if (target.includes(",")) {
    const parts = target.split(",").map((s) => s.trim()).filter(Boolean)
    return { host: parts[0], port: null, targets: parts }
  }

  return { host: target, port: null, targets: [target] }
}

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
