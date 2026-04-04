/**
 * Planning worker — handles "plan_round" jobs.
 * Calls the LLM planner to generate an execution plan for the current round.
 */

import * as projectRepo from "@/lib/repositories/project-repo"
import * as assetRepo from "@/lib/repositories/asset-repo"
import * as findingRepo from "@/lib/repositories/finding-repo"
import * as mcpRunRepo from "@/lib/repositories/mcp-run-repo"
import * as mcpToolRepo from "@/lib/repositories/mcp-tool-repo"
import * as approvalRepo from "@/lib/repositories/approval-repo"
import * as auditRepo from "@/lib/repositories/audit-repo"
import { prisma } from "@/lib/infra/prisma"
import { publishEvent } from "@/lib/infra/event-bus"
import { createPgBossJobQueue } from "@/lib/infra/job-queue"
import { registerAbort, unregisterAbort } from "@/lib/infra/abort-registry"
import { createPipelineLogger } from "@/lib/infra/pipeline-logger"
import { transition } from "@/lib/domain/lifecycle"
import { requiresApproval, type ApprovalPolicy } from "@/lib/domain/risk-policy"
import {
  getLlmProvider,
  buildPlannerPrompt,
  parseLlmJson,
  type LlmPlanResponse,
  type PlannerContext,
} from "@/lib/llm"
import type { RiskLevel, PentestPhase } from "@/lib/generated/prisma"

export async function handlePlanRound(data: { projectId: string; round: number }) {
  const { projectId, round } = data
  const log = createPipelineLogger(projectId, "plan_round", { round })
  log.info("started", `开始规划第 ${round} 轮`)

  const project = await projectRepo.findById(projectId)
  if (!project) {
    log.error("failed", `项目 ${projectId} 不存在`)
    return
  }

  if (project.lifecycle === "stopped" || project.lifecycle === "stopping") {
    log.info("skipped", `项目已 ${project.lifecycle}，跳过规划`)
    return
  }

  if (project.lifecycle !== "planning") {
    log.warn("skipped", `项目处于 ${project.lifecycle} 状态，跳过规划`)
    return
  }

  try {

    // Create orchestrator round record
    await prisma.orchestratorRound.upsert({
      where: { projectId_round: { projectId, round } },
      create: { projectId, round, phase: project.currentPhase, status: "planning" },
      update: { status: "planning" },
    })

    // Gather context for the planner
    const assets = await assetRepo.findByProject(projectId)
    const findings = await findingRepo.findByProject(projectId)
    const enabledTools = await mcpToolRepo.findEnabled()
    const previousRuns = round > 1
      ? await mcpRunRepo.findByProjectAndRound(projectId, round - 1)
      : []

    // Build detailed previous round info with rawOutput for LLM context
    let previousRoundDetails = previousRuns.length > 0
      ? previousRuns.map((r) => ({
          toolName: r.toolName,
          target: r.target,
          status: r.status,
          rawOutput: r.rawOutput?.slice(0, 2000) ?? undefined,
          error: r.error?.slice(0, 500) ?? undefined,
        }))
      : undefined

    // Total output size control — prevent exceeding LLM context
    if (previousRoundDetails) {
      const MAX_TOTAL_OUTPUT = 10000
      const totalLength = previousRoundDetails.reduce((sum, r) => sum + (r.rawOutput?.length ?? 0), 0)
      if (totalLength > MAX_TOTAL_OUTPUT) {
        const ratio = MAX_TOTAL_OUTPUT / totalLength
        for (const r of previousRoundDetails) {
          if (r.rawOutput) {
            r.rawOutput = r.rawOutput.slice(0, Math.floor(r.rawOutput.length * ratio)) + "...(truncated)"
          }
        }
      }
    }

    const plannerCtx: PlannerContext = {
      projectName: project.name,
      targets: project.targets.map((t) => ({ value: t.value, type: t.type })),
      currentPhase: project.currentPhase,
      round,
      maxRounds: project.maxRounds,
      availableTools: enabledTools.map((t) => ({
        toolName: t.toolName,
        capability: t.capability,
        description: t.description,
      })),
      assets: assets.map((a) => ({ kind: a.kind, value: a.value, label: a.label })),
      findings: findings.map((f) => ({
        title: f.title,
        status: f.status,
        severity: f.severity,
      })),
      previousRoundDetails,
    }

    // Call LLM planner (with abort support)
    const abortController = new AbortController()
    registerAbort(projectId, abortController)

    const timer = log.startTimer()
    log.info("llm_call", "调用 planner LLM")

    const llm = await getLlmProvider(projectId, "planner")
    const messages = await buildPlannerPrompt(plannerCtx)
    const response = await llm.chat(messages, { jsonMode: true, signal: abortController.signal })
    unregisterAbort(projectId, abortController)

    const plan = parseLlmJson<LlmPlanResponse>(response.content)

    // Validate and cap plan items
    const items = (plan.items ?? []).slice(0, 5)

    log.info("llm_response", `LLM 返回 ${items.length} 个计划项`, { summary: plan.summary, phase: plan.phase }, timer.elapsed())

    // Save plan to database
    await prisma.orchestratorPlan.upsert({
      where: { projectId_round: { projectId, round } },
      create: {
        projectId,
        round,
        phase: plan.phase ?? project.currentPhase,
        provider: response.provider,
        summary: plan.summary ?? "",
        items: items as unknown as object,
      },
      update: {
        phase: plan.phase ?? project.currentPhase,
        summary: plan.summary ?? "",
        items: items as unknown as object,
      },
    })

    // Update phase (advance if LLM suggests, otherwise keep current)
    const effectivePhase = plan.phase ?? project.currentPhase
    await projectRepo.updatePhaseAndRound(projectId, effectivePhase, round)

    // Update round record
    await prisma.orchestratorRound.update({
      where: { projectId_round: { projectId, round } },
      data: { planItemCount: items.length, status: "executing", phase: plan.phase ?? project.currentPhase },
    })

    // Create MCP runs for each plan item
    const queue = createPgBossJobQueue()
    const globalConfig = await prisma.globalConfig.findUnique({ where: { id: "global" } })
    const policy: ApprovalPolicy = {
      approvalEnabled: globalConfig?.approvalEnabled ?? false,
      autoApproveLowRisk: globalConfig?.autoApproveLowRisk ?? true,
      autoApproveMediumRisk: globalConfig?.autoApproveMediumRisk ?? false,
    }

    let needsApproval = false

    for (const item of items) {
      const riskLevel = (item.riskLevel ?? "medium") as RiskLevel
      const phase = (item.phase ?? plan.phase ?? project.currentPhase) as PentestPhase

      // Find the tool in registry for its ID
      const tool = await mcpToolRepo.findByToolName(item.toolName)

      const mcpRun = await mcpRunRepo.create({
        projectId,
        toolId: tool?.id,
        capability: tool?.capability ?? "general",
        toolName: item.toolName,
        target: item.target,
        requestedAction: item.action,
        riskLevel,
        phase,
        round,
      })

      // Check if approval is needed
      const needsApprovalForRun = requiresApproval(riskLevel, policy) || (tool?.requiresApproval ?? false)

      if (needsApprovalForRun) {
        needsApproval = true
        await approvalRepo.create({
          projectId,
          mcpRunId: mcpRun.id,
          target: item.target,
          actionType: item.action,
          riskLevel,
          rationale: item.rationale,
        })
        await mcpRunRepo.updateStatus(mcpRun.id, "pending")

        await publishEvent({
          type: "approval_needed",
          projectId,
          timestamp: new Date().toISOString(),
          data: { mcpRunId: mcpRun.id, toolName: item.toolName, target: item.target, riskLevel },
        })
      } else {
        // Queue for immediate execution
        await mcpRunRepo.updateStatus(mcpRun.id, "scheduled")
        const jobId = await queue.publish("execute_tool", { projectId, mcpRunId: mcpRun.id })
        if (jobId) {
          await mcpRunRepo.updateStatus(mcpRun.id, "scheduled", { pgBossJobId: jobId })
        }
      }
    }

    // Transition lifecycle: planning → executing (always)
    await projectRepo.updateLifecycle(projectId, transition("planning", "PLAN_READY"))

    if (needsApproval) {
      await projectRepo.updateLifecycle(projectId, transition("executing", "APPROVAL_NEEDED"))
    } else if (items.length === 0) {
      // Empty plan — go directly to round review
      await queue.publish("round_completed", { projectId, round })
    }

    await publishEvent({
      type: "plan_created",
      projectId,
      timestamp: new Date().toISOString(),
      data: { round, itemCount: items.length, phase: plan.phase, summary: plan.summary },
    })

    await auditRepo.create({
      projectId,
      category: "orchestration",
      action: "plan_created",
      actor: "system",
      detail: `Round ${round}: ${items.length} tasks planned (${plan.phase})`,
    })

    log.info("completed", `规划完成: ${items.length} 个任务 (${plan.phase})`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error("failed", `规划失败: ${message}`, { error: message })

    try {
      await prisma.orchestratorRound.update({
        where: { projectId_round: { projectId, round } },
        data: { status: "failed" },
      }).catch(() => {})

      await publishEvent({
        type: "plan_failed",
        projectId,
        timestamp: new Date().toISOString(),
        data: { round, error: message.slice(0, 500) },
      })
    } catch {
      // swallow — best effort
    }

    throw err // pg-boss will retry
  }
}
