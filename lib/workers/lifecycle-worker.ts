/**
 * Lifecycle worker — handles "round_completed" and "settle_closure" jobs.
 * Manages round transitions and project completion.
 */

import * as projectRepo from "@/lib/repositories/project-repo"
import * as mcpRunRepo from "@/lib/repositories/mcp-run-repo"
import * as assetRepo from "@/lib/repositories/asset-repo"
import * as findingRepo from "@/lib/repositories/finding-repo"
import * as auditRepo from "@/lib/repositories/audit-repo"
import { prisma } from "@/lib/infra/prisma"
import { publishEvent } from "@/lib/infra/event-bus"
import { createPgBossJobQueue } from "@/lib/infra/job-queue"
import { transition } from "@/lib/domain/lifecycle"
import {
  getLlmProvider,
  buildReviewerPrompt,
  parseLlmJson,
  type LlmReviewDecision,
  type ReviewerContext,
} from "@/lib/llm"

export async function handleRoundCompleted(data: { projectId: string; round: number }) {
  const { projectId, round } = data
  console.log(`[lifecycle] Round ${round} completed for project ${projectId}`)

  const project = await projectRepo.findById(projectId)
  if (!project) {
    console.error(`[lifecycle] Project ${projectId} not found`)
    return
  }

  if (project.lifecycle === "stopped" || project.lifecycle === "stopping") {
    console.warn(`[lifecycle] Project ${projectId} is ${project.lifecycle}, skipping`)
    return
  }

  try {
    // Update round status
    await prisma.orchestratorRound.update({
      where: { projectId_round: { projectId, round } },
      data: { status: "completed", completedAt: new Date() },
    }).catch(() => {})

    // Gather round summary for reviewer
    const runs = await mcpRunRepo.findByProjectAndRound(projectId, round)
    const totalAssets = await assetRepo.countByProject(projectId)
    const findings = await findingRepo.findByProject(projectId)

    const succeeded = runs.filter((r) => r.status === "succeeded")
    const failed = runs.filter((r) => r.status === "failed")
    const unverified = findings.filter((f) => f.status === "suspected" || f.status === "verifying")

    const roundSummary = [
      `工具执行: ${succeeded.length} 成功, ${failed.length} 失败 (共 ${runs.length})`,
      ...succeeded.map((r) => {
        const output = r.rawOutput?.slice(0, 200) ?? "(no output)"
        return `  ✓ ${r.toolName}(${r.target}): ${output}`
      }),
      ...failed.map((r) => `  ✗ ${r.toolName}(${r.target}): ${r.error?.slice(0, 100) ?? "unknown error"}`),
    ].join("\n")

    // Transition to reviewing — must be in executing state
    // If in waiting_approval, resolve first
    if (project.lifecycle === "waiting_approval") {
      await projectRepo.updateLifecycle(projectId, transition("waiting_approval", "RESOLVED"))
    }
    await projectRepo.updateLifecycle(projectId, transition("executing", "ALL_DONE"))

    // Call LLM reviewer
    const reviewerCtx: ReviewerContext = {
      projectName: project.name,
      currentPhase: project.currentPhase,
      round,
      maxRounds: project.maxRounds,
      roundSummary,
      totalAssets,
      totalFindings: findings.length,
      unverifiedFindings: unverified.length,
    }

    const llm = await getLlmProvider(projectId, "reviewer")
    const messages = buildReviewerPrompt(reviewerCtx)
    const response = await llm.chat(messages, { jsonMode: true })
    const decision = parseLlmJson<LlmReviewDecision>(response.content)

    const queue = createPgBossJobQueue()

    if (decision.decision === "settle" || round >= project.maxRounds) {
      // Time to wrap up
      console.log(`[lifecycle] Reviewer decision: SETTLE (round ${round}/${project.maxRounds})`)
      console.log(`[lifecycle] Reasoning: ${decision.reasoning}`)

      await projectRepo.updateLifecycle(projectId, transition("reviewing", "SETTLE"))
      await queue.publish("settle_closure", { projectId })
    } else {
      // Continue with next round
      const nextPhase = decision.nextPhase ?? project.currentPhase
      console.log(`[lifecycle] Reviewer decision: CONTINUE → ${nextPhase} (round ${round + 1})`)
      console.log(`[lifecycle] Reasoning: ${decision.reasoning}`)

      await projectRepo.updateLifecycle(projectId, transition("reviewing", "CONTINUE"))
      await queue.publish("plan_round", { projectId, round: round + 1 })
    }

    await publishEvent({
      type: "round_reviewed",
      projectId,
      timestamp: new Date().toISOString(),
      data: {
        round,
        decision: decision.decision,
        nextPhase: decision.nextPhase,
        reasoning: decision.reasoning,
        stats: {
          totalRuns: runs.length,
          succeeded: succeeded.length,
          failed: failed.length,
          totalAssets,
          totalFindings: findings.length,
          unverifiedFindings: unverified.length,
        },
      },
    })

    await auditRepo.create({
      projectId,
      category: "orchestration",
      action: "round_reviewed",
      actor: "system",
      detail: `Round ${round}: ${decision.decision} → ${decision.nextPhase ?? "settle"}. ${decision.reasoning.slice(0, 200)}`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[lifecycle] Error handling round completion:`, message)

    // On reviewer failure, try to continue anyway with next round
    // (don't block the pipeline on reviewer errors)
    if (round < project.maxRounds) {
      try {
        // Force back to reviewing first (if not already), then CONTINUE
        const current = await projectRepo.findById(projectId)
        if (current && current.lifecycle === "reviewing") {
          await projectRepo.updateLifecycle(projectId, transition("reviewing", "CONTINUE"))
        } else {
          // Fallback: try executing → reviewing → planning chain
          await projectRepo.updateLifecycle(projectId, transition("executing", "ALL_DONE"))
          await projectRepo.updateLifecycle(projectId, transition("reviewing", "CONTINUE"))
        }
        const queue = createPgBossJobQueue()
        await queue.publish("plan_round", { projectId, round: round + 1 })
      } catch {
        await projectRepo.updateLifecycle(projectId, "failed").catch(() => {})
      }
    } else {
      await projectRepo.updateLifecycle(projectId, "failed").catch(() => {})
    }

    throw err
  }
}

export async function handleSettleClosure(data: { projectId: string }) {
  const { projectId } = data
  console.log(`[lifecycle] Settling project ${projectId}`)

  const project = await projectRepo.findById(projectId)
  if (!project) {
    console.error(`[lifecycle] Project ${projectId} not found`)
    return
  }

  try {
    // Gather final statistics
    const assets = await assetRepo.findByProject(projectId)
    const findings = await findingRepo.findByProject(projectId)
    const runs = await mcpRunRepo.findByProject(projectId)

    const verified = findings.filter((f) => f.status === "verified")
    const falsePositive = findings.filter((f) => f.status === "false_positive")
    const suspected = findings.filter((f) => f.status === "suspected")

    const summary = [
      `# 安全评估完成报告`,
      ``,
      `## 统计`,
      `- 总资产: ${assets.length}`,
      `- 总发现: ${findings.length}`,
      `  - 已验证: ${verified.length}`,
      `  - 误报: ${falsePositive.length}`,
      `  - 待验证: ${suspected.length}`,
      `- 工具执行: ${runs.length}`,
      `- 总轮次: ${project.currentRound}`,
      ``,
      `## 已验证漏洞`,
      ...verified.map((f) => `- [${f.severity}] ${f.title}: ${f.summary.slice(0, 100)}`),
      ``,
      `## 信息类发现`,
      ...findings.filter((f) => f.severity === "info").map((f) => `- ${f.title}`),
    ].join("\n")

    // Save final report as an audit event
    await auditRepo.create({
      projectId,
      category: "report",
      action: "closure_settled",
      actor: "system",
      detail: summary.slice(0, 5000),
    })

    // Mark project as completed
    await projectRepo.updateLifecycle(projectId, transition("settling", "SETTLED"))

    await publishEvent({
      type: "project_completed",
      projectId,
      timestamp: new Date().toISOString(),
      data: {
        totalAssets: assets.length,
        totalFindings: findings.length,
        verifiedFindings: verified.length,
        falsePositives: falsePositive.length,
        totalRounds: project.currentRound,
        totalRuns: runs.length,
      },
    })

    console.log(`[lifecycle] Project ${projectId} completed: ${verified.length} verified findings out of ${findings.length} total`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[lifecycle] Error settling project:`, message)

    await projectRepo.updateLifecycle(projectId, "failed").catch(() => {})

    await publishEvent({
      type: "settle_failed",
      projectId,
      timestamp: new Date().toISOString(),
      data: { error: message.slice(0, 500) },
    })

    throw err
  }
}
