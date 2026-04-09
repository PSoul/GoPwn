/**
 * ReAct worker — handles "react_round" jobs.
 * Runs a ReAct loop: LLM function call → MCP tool execution → result feedback → repeat.
 */

import * as projectRepo from "@/lib/repositories/project-repo"
import * as assetRepo from "@/lib/repositories/asset-repo"
import * as findingRepo from "@/lib/repositories/finding-repo"
import * as mcpRunRepo from "@/lib/repositories/mcp-run-repo"
import * as mcpToolRepo from "@/lib/repositories/mcp-tool-repo"
import * as auditRepo from "@/lib/repositories/audit-repo"
import { prisma } from "@/lib/infra/prisma"
import { publishEvent } from "@/lib/infra/event-bus"
import { createPgBossJobQueue } from "@/lib/infra/job-queue"
import { registerAbort, unregisterAbort } from "@/lib/infra/abort-registry"
import { createPipelineLogger } from "@/lib/infra/pipeline-logger"
import { transition, isTerminalOrSettling } from "@/lib/domain/lifecycle"
import { callTool } from "@/lib/mcp"
import { getLlmProvider } from "@/lib/llm"
import { buildReactSystemPrompt, type ReactContext } from "@/lib/llm/react-prompt"
import { mcpToolsToFunctions, getControlFunctions } from "@/lib/llm/function-calling"
import { buildToolInputFromFunctionArgs } from "@/lib/llm/tool-input-mapper"
import { createScopePolicy } from "@/lib/domain/scope-policy"
import { ReactContextManager } from "./react-context"
import type { Severity, PentestPhase, RiskLevel, Prisma } from "@/lib/generated/prisma"

const MAX_STEPS_PER_ROUND = 30
const MAX_EMPTY_RETRIES = 3      // LLM 连续空响应最大重试次数

/** 从 inputSchema 中提取关键参数摘要，帮助 LLM 正确填写参数 */
function buildParameterHints(inputSchema: unknown): string | undefined {
  const schema = inputSchema as Record<string, unknown> | null
  if (!schema?.properties) return undefined
  const props = schema.properties as Record<string, { type?: string; description?: string; enum?: string[] }>
  const required = new Set((schema.required ?? []) as string[])
  const hints: string[] = []
  for (const [name, prop] of Object.entries(props)) {
    if (name === "target") continue // target 太明显，省略
    const req = required.has(name) ? "必填" : "可选"
    const enumStr = prop.enum ? ` [${prop.enum.join("|")}]` : ""
    const desc = prop.description ? `: ${prop.description}` : ""
    hints.push(`${name}(${req}${enumStr})${desc}`)
  }
  return hints.length > 0 ? hints.join(", ") : undefined
}
const TOOL_TIMEOUT_MS = 300_000  // 5 min per tool
const ANALYSIS_WAIT_MS = 30_000  // wait for pending analyses at round end

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tool execution timeout after ${ms}ms: ${label}`)), ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

export async function handleReactRound(data: {
  projectId: string
  round: number
}): Promise<void> {
  const { projectId, round } = data
  const log = createPipelineLogger(projectId, "react_round", { round })
  log.info("started", `开始 ReAct 第 ${round} 轮`)

  const project = await projectRepo.findById(projectId)
  if (!project) {
    log.error("failed", `项目 ${projectId} 不存在`)
    return
  }

  if (isTerminalOrSettling(project.lifecycle)) {
    log.info("skipped", `项目已 ${project.lifecycle}，跳过`)
    return
  }

  // Guard: 防止同一 round 被并行执行
  const existingRound = await prisma.orchestratorRound.findUnique({
    where: { projectId_round: { projectId, round } },
    select: { status: true },
  })
  if (existingRound && existingRound.status === "executing") {
    log.info("skipped", `第 ${round} 轮已在执行中，跳过重复作业`)
    return
  }

  const abortController = new AbortController()
  registerAbort(projectId, abortController)

  try {
    // Transition to executing (skip if already executing — e.g. retry after failure)
    if (project.lifecycle !== "executing") {
      const ALLOWED_STARTS = ["idle", "planning", "failed", "reviewing"] as const
      if (!(ALLOWED_STARTS as readonly string[]).includes(project.lifecycle)) {
        log.info("skipped", `项目状态 ${project.lifecycle} 无法启动 ReAct，跳过`)
        return
      }
      const event =
        project.lifecycle === "failed" ? "RETRY_REACT" as const
        : project.lifecycle === "reviewing" ? "CONTINUE_REACT" as const
        : "START_REACT" as const
      await projectRepo.updateLifecycle(projectId, transition(project.lifecycle, event))
    }

    // Create/update round record
    await prisma.orchestratorRound.upsert({
      where: { projectId_round: { projectId, round } },
      create: { projectId, round, phase: project.currentPhase, status: "executing", maxSteps: MAX_STEPS_PER_ROUND },
      update: { status: "executing", maxSteps: MAX_STEPS_PER_ROUND },
    })

    // Gather context
    const assets = await assetRepo.findByProject(projectId)
    const findings = await findingRepo.findByProject(projectId)
    const enabledTools = await mcpToolRepo.findEnabled()

    // Build scope policy from target values
    const scopePolicy = createScopePolicy(project.targets.map((t) => t.value))

    // Convert MCP tools to OpenAI functions
    const mcpFunctions = mcpToolsToFunctions(enabledTools)
    const controlFunctions = getControlFunctions()
    const allFunctions = [...mcpFunctions, ...controlFunctions]

    // Build initial context with available tool names
    const reactCtx: ReactContext = {
      projectName: project.name,
      projectDescription: project.description || undefined,
      targets: project.targets.map((t) => ({ value: t.value, type: t.type })),
      currentPhase: project.currentPhase,
      round,
      maxRounds: project.maxRounds,
      maxSteps: MAX_STEPS_PER_ROUND,
      stepIndex: 0,
      scopeDescription: scopePolicy.describe(),
      assets: assets.map((a) => ({ kind: a.kind, value: a.value, label: a.label })),
      findings: findings.map((f) => ({ title: f.title, severity: f.severity, affectedTarget: f.affectedTarget, status: f.status })),
      availableTools: enabledTools.map((t) => ({
        name: t.toolName,
        description: t.description || "",
        parameterHints: buildParameterHints(t.inputSchema),
      })),
    }

    const systemPrompt = await buildReactSystemPrompt(reactCtx)
    const initialMessage = `开始第 ${round} 轮渗透测试。目标: ${project.targets.map((t) => t.value).join(", ")}。请立即选择第一个工具并调用。`

    const ctxManager = new ReactContextManager(systemPrompt, initialMessage)
    const llm = await getLlmProvider(projectId, "react")
    const queue = createPgBossJobQueue()
    const pendingAnalyses: Promise<unknown>[] = []

    let stopReason: string = "max_steps"
    let lastThought: string = ""
    let consecutiveEmptyRetries = 0

    // === ReAct Loop ===
    for (let stepIndex = 0; stepIndex < MAX_STEPS_PER_ROUND; stepIndex++) {
      // Check abort signal or project terminal state
      if (abortController.signal.aborted) {
        stopReason = "aborted"
        log.info("aborted", `项目被停止，结束循环`)
        break
      }
      // 每 5 步检查项目是否已被外部停止/结算（防止 abort registry 竞态）
      if (stepIndex > 0 && stepIndex % 5 === 0) {
        const fresh = await projectRepo.findById(projectId)
        if (!fresh || isTerminalOrSettling(fresh.lifecycle)) {
          stopReason = "project_terminated"
          log.info("aborted", `项目已 ${fresh?.lifecycle ?? "deleted"}，结束循环`)
          break
        }
      }

      // Call LLM with function calling
      const timer = log.startTimer()
      log.info("llm_call", `Step ${stepIndex}: 调用 LLM`)

      let response
      try {
        response = await llm.chat(ctxManager.getMessages(), {
          functions: allFunctions,
          function_call: "auto",
          signal: abortController.signal,
        })
        consecutiveEmptyRetries = 0 // 成功调用，重置计数
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        // LLM 空响应错误 → 重试几次，可能是 API 临时异常
        if (errMsg.includes("LLM 返回空响应") && consecutiveEmptyRetries < MAX_EMPTY_RETRIES) {
          consecutiveEmptyRetries++
          log.warn("llm_empty", `LLM 空响应 (重试 ${consecutiveEmptyRetries}/${MAX_EMPTY_RETRIES}, ${timer.elapsed()}ms): ${errMsg}`)
          ctxManager.addAssistantMessage("")
          ctxManager.addToolResult({
            stepIndex, toolName: "system", target: "", functionName: "system",
            output: "上一次调用未收到任何响应，请重新选择工具并调用。",
            status: "failed", thought: "", toolCallId: undefined,
          })
          continue
        }
        throw err // 超过重试次数或其他错误，向上抛出
      }

      // Parse LLM response
      if (!response.functionCall) {
        // No function call — LLM returned text without selecting a tool
        lastThought = response.content
        log.info("llm_no_action", `LLM 未调用工具 (step ${stepIndex}): ${response.content.slice(0, 200)}`, null, timer.elapsed())
        ctxManager.addAssistantMessage(response.content)
        stopReason = "llm_no_action"
        break
      }

      const { name: fnName, arguments: fnArgsStr } = response.functionCall
      const toolCallId = response.toolCallId || undefined
      const thought = response.content || ""
      lastThought = thought

      log.info("function_call", `Step ${stepIndex}: ${fnName}`, { thought: thought.slice(0, 200) }, timer.elapsed())

      // Handle control function: done
      if (fnName === "done") {
        stopReason = "llm_done"
        let doneArgs: { summary?: string; phase_suggestion?: string } = {}
        try { doneArgs = JSON.parse(fnArgsStr) } catch { log.warn("parse_args", `done 参数解析失败: ${fnArgsStr.slice(0, 200)}`) }
        log.info("llm_done", `LLM 主动停止: ${doneArgs.summary ?? ""}`)

        const VALID_PHASES: readonly string[] = ["recon", "discovery", "assessment", "verification", "reporting"]
        if (doneArgs.phase_suggestion && VALID_PHASES.includes(doneArgs.phase_suggestion)) {
          await projectRepo.updatePhaseAndRound(projectId, doneArgs.phase_suggestion as PentestPhase, round)
        }

        ctxManager.addAssistantMessage(thought, { name: fnName, arguments: fnArgsStr }, toolCallId)
        ctxManager.addToolResult({
          stepIndex, toolName: "done", target: "", functionName: fnName,
          output: `Round ended by LLM decision. Summary: ${doneArgs.summary ?? ""}`,
          status: "succeeded", thought, toolCallId,
        })
        break
      }

      // Handle control function: report_finding
      if (fnName === "report_finding") {
        let findingArgs: { title: string; severity: string; target: string; detail: string; recommendation?: string } = {
          title: "Unknown", severity: "info", target: "", detail: "",
        }
        try { findingArgs = JSON.parse(fnArgsStr) } catch { log.warn("parse_args", `report_finding 参数解析失败: ${fnArgsStr.slice(0, 200)}`) }

        await findingRepo.create({
          projectId,
          severity: findingArgs.severity as Severity,
          title: findingArgs.title,
          summary: findingArgs.detail,
          affectedTarget: findingArgs.target,
          recommendation: findingArgs.recommendation,
        })
        log.info("finding_reported", `LLM 直接报告: ${findingArgs.title}`)

        ctxManager.addAssistantMessage(thought, { name: fnName, arguments: fnArgsStr }, toolCallId)
        ctxManager.addToolResult({
          stepIndex, toolName: "report_finding", target: findingArgs.target, functionName: fnName,
          output: `Finding reported: ${findingArgs.title} [${findingArgs.severity}]`,
          status: "succeeded", thought, toolCallId,
        })

        await publishEvent({
          type: "react_step_completed",
          projectId,
          timestamp: new Date().toISOString(),
          data: { round, stepIndex, toolName: "report_finding", status: "succeeded", outputPreview: findingArgs.title },
        }).catch(() => {})
        continue
      }

      // === MCP Tool Execution ===
      let fnArgs: Record<string, unknown> = {}
      try { fnArgs = JSON.parse(fnArgsStr) } catch { log.warn("parse_args", `${fnName} 参数解析失败: ${fnArgsStr.slice(0, 200)}`) }

      // Extract target from function args
      const targetValue = String(fnArgs.target ?? fnArgs.url ?? fnArgs.host ?? fnArgs.address ?? "")

      // Check scope
      if (targetValue && !scopePolicy.isInScope(targetValue)) {
        log.warn("scope_exceeded", `目标 ${targetValue} 超出 scope`)
        ctxManager.addAssistantMessage(thought, { name: fnName, arguments: fnArgsStr }, toolCallId)
        ctxManager.addToolResult({
          stepIndex, toolName: fnName, target: targetValue, functionName: fnName,
          output: `目标 "${targetValue}" 超出 scope 范围，已记录但未执行。Scope: ${scopePolicy.describe()}`,
          status: "failed", thought, toolCallId,
        })
        await publishEvent({
          type: "scope_exceeded",
          projectId,
          timestamp: new Date().toISOString(),
          data: { target: targetValue, reason: "out of scope" },
        }).catch(() => {})
        continue
      }

      // Publish step started event (fire-and-forget — don't block pipeline on UI notification)
      await publishEvent({
        type: "react_step_started",
        projectId,
        timestamp: new Date().toISOString(),
        data: { round, stepIndex, thought: thought.slice(0, 300), toolName: fnName, target: targetValue },
      }).catch(() => {})

      // Create mcp_run record
      const tool = await mcpToolRepo.findByToolName(fnName)
      const mcpRun = await mcpRunRepo.create({
        projectId,
        toolId: tool?.id,
        capability: tool?.capability ?? "general",
        toolName: fnName,
        target: targetValue,
        requestedAction: thought,
        riskLevel: (tool?.riskLevel ?? "low") as RiskLevel,
        phase: project.currentPhase,
        round,
        stepIndex,
        thought,
        functionArgs: fnArgs as Prisma.InputJsonValue,
      })
      await mcpRunRepo.updateStatus(mcpRun.id, "running", { startedAt: new Date() })

      // Execute MCP tool
      let toolOutput: string
      let toolStatus: "succeeded" | "failed" = "succeeded"
      const toolTimer = log.startTimer()

      try {
        const toolInput = await buildToolInputFromFunctionArgs(fnName, fnArgs, targetValue, thought)

        const result = await withTimeout(
          callTool(fnName, toolInput),
          TOOL_TIMEOUT_MS,
          `${fnName}(${targetValue})`,
        )
        toolOutput = result.isError ? `Error: ${result.content}` : result.content
        toolStatus = result.isError ? "failed" : "succeeded"
      } catch (err) {
        toolOutput = `Error: ${err instanceof Error ? err.message : String(err)}`
        toolStatus = "failed"
      }

      // 记录 MCP 工具执行结果
      const toolElapsed = toolTimer.elapsed()
      if (toolStatus === "failed") {
        log.error("mcp_error", `Step ${stepIndex}: ${fnName} → ${targetValue} 失败 (${toolElapsed}ms): ${toolOutput.slice(0, 300)}`, { args: fnArgs, error: toolOutput.slice(0, 500) })
      } else {
        log.info("mcp_result", `Step ${stepIndex}: ${fnName} → ${targetValue} 成功 (${toolElapsed}ms), 输出 ${toolOutput.length} 字符`, { outputPreview: toolOutput.slice(0, 200) }, toolElapsed)
      }

      // Save result
      await mcpRunRepo.updateStatus(mcpRun.id, toolStatus, {
        rawOutput: toolOutput.slice(0, 100_000),
        error: toolStatus === "failed" ? toolOutput.slice(0, 500) : undefined,
        completedAt: new Date(),
      })

      // Add to context
      ctxManager.addAssistantMessage(thought, { name: fnName, arguments: fnArgsStr }, toolCallId)
      ctxManager.addToolResult({
        stepIndex, toolName: fnName, target: targetValue, functionName: fnName,
        output: toolOutput, status: toolStatus, thought, toolCallId,
      })

      // Queue async analysis for successful results
      if (toolStatus === "succeeded" && toolOutput.length > 10) {
        pendingAnalyses.push(
          queue.publish("analyze_result", {
            projectId,
            mcpRunId: mcpRun.id,
            rawOutput: toolOutput.slice(0, 50_000),
            toolName: fnName,
            target: targetValue,
          }),
        )
      }

      // Update round stats
      await prisma.orchestratorRound.update({
        where: { projectId_round: { projectId, round } },
        data: { actualSteps: stepIndex + 1, executedCount: { increment: 1 } },
      }).catch(() => {})

      // Publish step completed event
      await publishEvent({
        type: "react_step_completed",
        projectId,
        timestamp: new Date().toISOString(),
        data: { round, stepIndex, toolName: fnName, status: toolStatus, outputPreview: toolOutput.slice(0, 300) },
      }).catch(() => {})

      // Refresh assets/findings every 5 steps for updated system prompt
      if ((stepIndex + 1) % 5 === 0) {
        const freshAssets = await assetRepo.findByProject(projectId)
        const freshFindings = await findingRepo.findByProject(projectId)
        reactCtx.stepIndex = stepIndex + 1
        reactCtx.assets = freshAssets.map((a) => ({ kind: a.kind, value: a.value, label: a.label }))
        reactCtx.findings = freshFindings.map((f) => ({ title: f.title, severity: f.severity, affectedTarget: f.affectedTarget, status: f.status }))
        const updatedPrompt = await buildReactSystemPrompt(reactCtx)
        ctxManager.updateSystemPrompt(updatedPrompt)
      }
    }

    // === Round Completion ===

    // Wait for pending analyses
    if (pendingAnalyses.length > 0) {
      log.info("waiting_analyses", `等待 ${pendingAnalyses.length} 个分析完成`)
      await Promise.race([
        Promise.allSettled(pendingAnalyses),
        new Promise((resolve) => setTimeout(resolve, ANALYSIS_WAIT_MS)),
      ])
    }

    // Update round record
    await prisma.orchestratorRound.update({
      where: { projectId_round: { projectId, round } },
      data: { status: "completed", stopReason, completedAt: new Date() },
    }).catch(() => {})

    // Publish round completed → triggers reviewer via lifecycle-worker
    await queue.publish("round_completed", { projectId, round }, {
      singletonKey: `round-complete-${projectId}-${round}`,
    })

    await publishEvent({
      type: "react_round_completed",
      projectId,
      timestamp: new Date().toISOString(),
      data: { round, stopReason, lastThought: lastThought.slice(0, 500) },
    }).catch(() => {})

    await auditRepo.create({
      projectId,
      category: "orchestration",
      action: "react_round_completed",
      actor: "system",
      detail: `Round ${round}: ${stopReason}, last thought: ${lastThought.slice(0, 200)}`,
    })

    log.info("completed", `ReAct 循环结束: ${stopReason}`)

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error("failed", `ReAct 循环失败: ${message}`, { error: message })

    try {
      await prisma.orchestratorRound.update({
        where: { projectId_round: { projectId, round } },
        data: { status: "failed", stopReason: "error" },
      }).catch(() => {})

      await publishEvent({
        type: "react_round_failed",
        projectId,
        timestamp: new Date().toISOString(),
        data: { round, error: message.slice(0, 500) },
      }).catch(() => {})
    } catch {
      // swallow — don't break the error handler
    }

    throw err // pg-boss will retry
  } finally {
    unregisterAbort(projectId, abortController)
  }
}
