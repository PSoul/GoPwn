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
  console.log(`[planning] Starting round ${round} for project ${projectId}`)

  const project = await projectRepo.findById(projectId)
  if (!project) {
    console.error(`[planning] Project ${projectId} not found`)
    return
  }

  // Only proceed if project is in planning state (startProject already transitioned idle→planning)
  if (project.lifecycle !== "planning") {
    console.warn(`[planning] Project ${projectId} is in ${project.lifecycle} state, skipping plan`)
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

    const previousSummary = previousRuns.length > 0
      ? previousRuns.map((r) => {
          const status = r.status === "succeeded" ? "✓" : "✗"
          return `${status} ${r.toolName}(${r.target}): ${r.rawOutput?.slice(0, 200) ?? "(no output)"}`
        }).join("\n")
      : undefined

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
      previousRoundSummary: previousSummary,
    }

    // Call LLM planner
    const llm = await getLlmProvider(projectId, "planner")
    const messages = await buildPlannerPrompt(plannerCtx)
    const response = await llm.chat(messages, { jsonMode: true })
    const plan = parseLlmJson<LlmPlanResponse>(response.content)

    // Validate and cap plan items
    const items = (plan.items ?? []).slice(0, 5)

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

    console.log(`[planning] Round ${round} planned: ${items.length} tasks for ${plan.phase}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[planning] Failed for project ${projectId} round ${round}:`, message)

    try {
      await projectRepo.updateLifecycle(projectId, "failed")
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
