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
import { registerAbort, unregisterAbort } from "@/lib/infra/abort-registry"
import { createPipelineLogger } from "@/lib/infra/pipeline-logger"
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
  const log = createPipelineLogger(projectId, "round_completed", { round })
  log.info("started", `第 ${round} 轮完成，开始审阅`)

  const project = await projectRepo.findById(projectId)
  if (!project) {
    log.error("failed", `项目 ${projectId} 不存在`)
    return
  }

  if (project.lifecycle === "stopped" || project.lifecycle === "stopping") {
    log.info("skipped", `项目已 ${project.lifecycle}，跳过审阅`)
    return
  }

  // Guard: skip if project is not in a state that can transition to reviewing.
  // This prevents duplicate round_completed jobs (from both react-worker and mcp-run-repo)
  // from triggering double reviews.
  if (project.lifecycle !== "executing" && project.lifecycle !== "waiting_approval") {
    log.info("skipped", `项目状态 ${project.lifecycle} 无法进入审阅，跳过（可能是重复的 round_completed 作业）`)
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

    // Fetch ReAct-specific round metadata
    const orchestratorRound = await prisma.orchestratorRound.findUnique({
      where: { projectId_round: { projectId, round } },
    })
    const lastThought = runs.length > 0
      ? runs
          .filter((r) => r.thought)
          .sort((a, b) => (b.stepIndex ?? 0) - (a.stepIndex ?? 0))[0]?.thought ?? null
      : null

    const reactContext = [
      `ReAct 循环: ${orchestratorRound?.actualSteps ?? runs.length} 步`,
      `停止原因: ${orchestratorRound?.stopReason ?? "unknown"}`,
      lastThought ? `LLM 最后推理: ${lastThought.slice(0, 300)}` : null,
    ].filter(Boolean).join("\n")

    const fullRoundSummary = `${roundSummary}\n\n${reactContext}`

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
      roundSummary: fullRoundSummary,
      totalAssets,
      totalFindings: findings.length,
      unverifiedFindings: unverified.length,
    }

    const abortController = new AbortController()
    registerAbort(projectId, abortController)

    const timer = log.startTimer()
    log.info("llm_call", "调用 reviewer LLM")

    const llm = await getLlmProvider(projectId, "reviewer")
    const messages = await buildReviewerPrompt(reviewerCtx)
    const response = await llm.chat(messages, { jsonMode: true, signal: abortController.signal })
    unregisterAbort(projectId, abortController)

    const decision = parseLlmJson<LlmReviewDecision>(response.content)

    log.info("llm_response", `审阅决策: ${decision.decision}`, { nextPhase: decision.nextPhase, reasoning: decision.reasoning }, timer.elapsed())

    const queue = createPgBossJobQueue()

    if (decision.decision === "settle" || round >= project.maxRounds) {
      // Time to wrap up
      log.info("state_transition", `SETTLE (第 ${round}/${project.maxRounds} 轮)`, { reasoning: decision.reasoning })

      await projectRepo.updateLifecycle(projectId, transition("reviewing", "SETTLE"))
      await queue.publish("settle_closure", { projectId })
    } else {
      // Continue with next round
      const nextPhase = decision.nextPhase ?? project.currentPhase
      log.info("state_transition", `CONTINUE → ${nextPhase} (第 ${round + 1} 轮)`, { reasoning: decision.reasoning })

      await projectRepo.updateLifecycle(projectId, transition("reviewing", "CONTINUE_REACT"))
      await queue.publish("react_round", { projectId, round: round + 1 }, {
        expireInSeconds: 1800,
        singletonKey: `react-round-${projectId}-${round + 1}`,
      })
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

    log.info("completed", `审阅完成: ${decision.decision}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error("failed", `审阅失败: ${message}`, { error: message })

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
          await projectRepo.updateLifecycle(projectId, transition("reviewing", "CONTINUE_REACT"))
        }
        const queue = createPgBossJobQueue()
        await queue.publish("react_round", { projectId, round: round + 1 }, {
          expireInSeconds: 1800,
          singletonKey: `react-round-${projectId}-${round + 1}`,
        })
        log.warn("recovery", `审阅失败但已恢复，继续第 ${round + 1} 轮`)
      } catch {
        await projectRepo.updateLifecycle(projectId, "failed").catch(() => {})
        log.error("recovery_failed", "恢复也失败了，项目标记为 failed")
      }
    } else {
      // Max rounds reached — settle the project even if reviewer failed
      // (don't mark as "failed" just because the reviewer LLM had an issue)
      try {
        const current = await projectRepo.findById(projectId)
        if (current && current.lifecycle === "reviewing") {
          await projectRepo.updateLifecycle(projectId, transition("reviewing", "SETTLE"))
        } else if (current && current.lifecycle === "executing") {
          await projectRepo.updateLifecycle(projectId, transition("executing", "ALL_DONE"))
          await projectRepo.updateLifecycle(projectId, transition("reviewing", "SETTLE"))
        }
        const queue = createPgBossJobQueue()
        await queue.publish("settle_closure", { projectId })
        log.warn("recovery", "审阅失败但已达最大轮次，直接结算项目")
      } catch {
        await projectRepo.updateLifecycle(projectId, "failed").catch(() => {})
        log.error("recovery_failed", "结算恢复也失败了，项目标记为 failed")
      }
    }

    // Don't re-throw — recovery already handled the situation.
    // Re-throwing causes pg-boss retries that conflict with the recovery transition.
  }
}

export async function handleSettleClosure(data: { projectId: string }) {
  const { projectId } = data
  const log = createPipelineLogger(projectId, "settle_closure")
  log.info("started", "开始结算项目")

  const project = await projectRepo.findById(projectId)
  if (!project) {
    log.error("failed", `项目 ${projectId} 不存在`)
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

    log.info("report", `报告生成: ${verified.length} 已验证, ${findings.length} 总发现, ${assets.length} 资产`)

    // Save final report as an audit event
    await auditRepo.create({
      projectId,
      category: "report",
      action: "closure_settled",
      actor: "system",
      detail: summary.slice(0, 5000),
    })

    // Mark project as completed (skip if already stopped — report still generated above)
    if (project.lifecycle === "settling") {
      await projectRepo.updateLifecycle(projectId, transition("settling", "SETTLED"))
    }

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

    log.info("completed", `项目结算完成: ${verified.length} 已验证漏洞 / ${findings.length} 总发现`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error("failed", `结算失败: ${message}`, { error: message })

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
