import { listStoredProjectApprovals } from "@/lib/data/approval-repository"
import { listStoredAssets } from "@/lib/data/asset-repository"
import { listStoredEvidence } from "@/lib/data/evidence-repository"
import { buildCompressedRoundHistory, buildLastRoundDetail, buildUnusedCapabilities, buildAssetSnapshot, buildMultiRoundBrainPrompt, buildFailedToolsSummary } from "@/lib/orchestration/orchestrator-context-builder"
import { getConfiguredLlmProviderStatus, resolveLlmProvider } from "@/lib/llm-provider/registry"
import { dispatchProjectMcpRunAndDrain } from "@/lib/project/project-mcp-dispatch-service"
import { formatTimestamp } from "@/lib/prototype-record-utils"
import { getStoredProjectById } from "@/lib/project/project-repository"
import { generateStoredProjectFinalConclusion, getStoredProjectReportExportPayload, listStoredProjectFindings } from "@/lib/project/project-results-repository"
import { getStoredProjectSchedulerControl } from "@/lib/project/project-scheduler-control-repository"
import { prisma } from "@/lib/infra/prisma"
import { toOrchestratorRoundRecord, fromOrchestratorRoundRecord, toMcpRunRecord } from "@/lib/infra/prisma-transforms"
import { listStoredWorkLogs, upsertStoredWorkLogs } from "@/lib/data/work-log-repository"
import { listStoredSchedulerTasks } from "@/lib/mcp/mcp-scheduler-repository"
import {
  getAvailableOrchestratorTools,
  buildProjectFallbackPlanItems,
  normalizePlanItems,
  normalizePlanRecord,
  persistProjectOrchestratorPlan,
} from "@/lib/orchestration/orchestrator-plan-builder"
import { filterPlanItemsToProjectScope } from "@/lib/orchestration/orchestrator-target-scope"
import type {
  ApprovalRecord,
  McpRunRecord,
  OrchestratorPlanItem,
  OrchestratorPlanPayload,
  OrchestratorRoundRecord,
} from "@/lib/prototype-types"

export type DispatchPlanResult = {
  approval?: ApprovalRecord
  runs: McpRunRecord[]
  status: "blocked" | "completed" | "waiting_approval"
}

export async function buildProjectRecentContext(projectId: string) {
  const project = await getStoredProjectById(projectId)

  if (!project) {
    return []
  }

  const assets = await listStoredAssets(projectId)
  const evidence = await listStoredEvidence(projectId)
  const findings = await listStoredProjectFindings(projectId)
  const approvals = await listStoredProjectApprovals(projectId)
  const workLogs = await listStoredWorkLogs(project.name)
  const dbRuns = await prisma.mcpRun.findMany({ where: { projectId } })
  const runs = dbRuns.map(toMcpRunRecord)

  return [
    ...assets.slice(0, 2).map((asset) => `资产 ${asset.label} (${asset.type}) / ${asset.scopeStatus}`),
    ...findings.slice(0, 2).map((finding) => `发现 ${finding.title} / ${finding.severity} / ${finding.status}`),
    ...evidence.slice(0, 2).map((record) => `证据 ${record.title} / ${record.conclusion}`),
    ...approvals.slice(0, 2).map((approval) => `审批 ${approval.actionType} / ${approval.status}`),
    ...runs.slice(0, 2).map((run) => `调度 ${run.requestedAction} / ${run.status}`),
    ...workLogs.slice(0, 2).map((log) => `${log.category} / ${log.summary}`),
  ].slice(0, 8)
}

async function hasActiveProjectSchedulerWork(projectId: string) {
  return (await listStoredSchedulerTasks(projectId)).some((task) =>
    ["ready", "retry_scheduled", "delayed", "running", "waiting_approval"].includes(task.status),
  )
}

export async function settleProjectLifecycleClosure(projectId: string, note?: string) {
  const project = await getStoredProjectById(projectId)
  const schedulerControl = await getStoredProjectSchedulerControl(projectId)

  if (!project || !schedulerControl) {
    return null
  }

  if (schedulerControl.lifecycle !== "running" || ["已停止", "已完成"].includes(project.status)) {
    return null
  }

  const pendingApprovals = (await listStoredProjectApprovals(projectId)).filter((approval) => approval.status === "待处理")

  if (pendingApprovals.length > 0 || await hasActiveProjectSchedulerWork(projectId)) {
    return null
  }

  const reportExport = await getStoredProjectReportExportPayload(projectId)

  if (!reportExport.latest) {
    const dispatch = await dispatchProjectMcpRunAndDrain(projectId, {
      capability: "报告导出类",
      requestedAction: "导出项目报告",
      target: project.code,
      riskLevel: "低",
    })

    if (!dispatch || dispatch.approval || dispatch.run.status === "已阻塞") {
      return null
    }
  }

  const conclusion = await generateStoredProjectFinalConclusion(projectId)

  if (conclusion) {
    upsertStoredWorkLogs([
      {
        id: `work-project-closure-${projectId}-${Date.now()}`,
        category: "项目收尾",
        summary: note
          ? `${note} 项目已进入最终结论阶段并完成当前轮次自动收尾。`
          : "项目已进入最终结论阶段并完成当前轮次自动收尾。",
        projectName: project.name,
        actor: conclusion.source === "reviewer" ? "reviewer-provider" : "reviewer-fallback",
        timestamp: formatTimestamp(),
        status: "已完成",
      },
    ])
  }

  return conclusion
}

export async function executePlanItems(
  projectId: string,
  items: OrchestratorPlanItem[],
  options?: {
    ignoreProjectLifecycle?: boolean
  },
): Promise<DispatchPlanResult> {
  const agentConfig = (await import("@/lib/settings/agent-config")).getAgentConfig()
  const maxParallel = agentConfig.execution.maxParallelTools

  const runs: McpRunRecord[] = []

  // 分离需要审批的高风险项（必须串行）和低风险项（可并行）
  const approvalItems = items.filter((i) => i.riskLevel === "高")
  const parallelItems = items.filter((i) => i.riskLevel !== "高")

  // 1. 并行执行低/中风险项（按 maxParallel 分批）
  for (let batchStart = 0; batchStart < parallelItems.length; batchStart += maxParallel) {
    const batch = parallelItems.slice(batchStart, batchStart + maxParallel)

    const results = await Promise.allSettled(
      batch.map((item) =>
        dispatchProjectMcpRunAndDrain(projectId, {
          capability: item.capability,
          requestedAction: item.requestedAction,
          target: item.target,
          riskLevel: item.riskLevel,
          preferredToolName: item.toolName,
          code: item.code,
        }, {
          ignoreProjectLifecycle: options?.ignoreProjectLifecycle,
        }),
      ),
    )

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        runs.push(result.value.run)
        // Parallel items shouldn't trigger approval, but handle edge cases
        if (result.value.approval) {
          return {
            approval: result.value.approval,
            runs,
            status: "waiting_approval",
          }
        }
      }
      // rejected promises are silently tolerated (tool failure)
    }
  }

  // 2. 串行执行高风险项（每个都可能触发审批阻塞）
  for (const item of approvalItems) {
    const payload = await dispatchProjectMcpRunAndDrain(projectId, {
      capability: item.capability,
      requestedAction: item.requestedAction,
      target: item.target,
      riskLevel: item.riskLevel,
      preferredToolName: item.toolName,
    }, {
      ignoreProjectLifecycle: options?.ignoreProjectLifecycle,
    })

    if (!payload) {
      continue
    }

    runs.push(payload.run)

    // Approval blocking stops the round
    if (payload.approval) {
      return {
        approval: payload.approval,
        runs,
        status: "waiting_approval",
      }
    }
  }

  return {
    runs,
    status: runs.length > 0 ? "completed" : "blocked",
  }
}

export async function recordOrchestratorRound(
  projectId: string,
  round: number,
  startedAt: string,
  execution: DispatchPlanResult,
  planItemCount: number,
): Promise<OrchestratorRoundRecord> {
  const beforeAssets = (await listStoredAssets(projectId)).length
  const beforeEvidence = (await listStoredEvidence(projectId)).length
  const beforeFindings = (await listStoredProjectFindings(projectId)).length

  const record: OrchestratorRoundRecord = {
    round,
    startedAt,
    completedAt: formatTimestamp(),
    planItemCount,
    executedCount: execution.runs.length,
    newAssetCount: (await listStoredAssets(projectId)).length - Math.max(0, beforeAssets - execution.runs.length),
    newEvidenceCount: (await listStoredEvidence(projectId)).length - Math.max(0, beforeEvidence - execution.runs.length),
    newFindingCount: (await listStoredProjectFindings(projectId)).length - Math.max(0, beforeFindings - execution.runs.length),
    failedActions: execution.runs
      .filter((r) => r.status === "已阻塞")
      .map((r) => `${r.toolName}(${r.target})`),
    blockedByApproval: execution.approval ? [`${execution.approval.actionType}(${execution.approval.target})`] : [],
    summaryForNextRound: `第${round}轮执行${execution.runs.length}个动作`,
    reflection: generateRoundReflection(execution, round),
  }

  const data = fromOrchestratorRoundRecord(record, projectId)
  await prisma.orchestratorRound.upsert({
    where: { projectId_round: { projectId, round } },
    create: data,
    update: data,
  })

  return record
}

/**
 * 轮间自我反思（确定性规则引擎，不消耗 LLM 调用）
 * 基于执行结果自动生成反思，供下一轮 LLM 参考。
 */
function generateRoundReflection(
  execution: DispatchPlanResult,
  round: number,
): OrchestratorRoundRecord["reflection"] {
  const succeeded = execution.runs.filter((r) => r.status === "已执行")
  const failed = execution.runs.filter((r) => r.status === "已阻塞" || r.status === "已取消")
  const toolsUsed = new Set(execution.runs.map((r) => r.toolName))

  // 关键发现
  const keyParts: string[] = []
  if (succeeded.length > 0) {
    keyParts.push(`${succeeded.length}个工具成功执行(${[...new Set(succeeded.map(r => r.toolName))].join(",")})`)
  }
  if (execution.approval) {
    keyParts.push(`发现需要审批的高风险操作: ${execution.approval.actionType}`)
  }
  const keyFindings = keyParts.length > 0 ? keyParts.join("; ") : "本轮无显著发现"

  // 失败教训
  let lessonsLearned = "无失败"
  if (failed.length > 0) {
    const failedTools = [...new Set(failed.map(r => r.toolName))].join(", ")
    const failRatio = failed.length / execution.runs.length
    if (failRatio > 0.5) {
      lessonsLearned = `超过半数工具失败(${failedTools})。建议下一轮缩小范围或使用 execute_code 自主实现。`
    } else {
      lessonsLearned = `部分工具失败(${failedTools})。可考虑调整参数重试或换用替代工具。`
    }
  }

  // 下一轮方向
  const directionParts: string[] = []
  if (succeeded.length > 0 && failed.length === 0) {
    directionParts.push("所有工具执行成功，可以进入更深层的探测或验证阶段")
  }
  if (execution.approval) {
    directionParts.push("等待人工审批后继续高风险验证")
  }
  if (round === 1) {
    directionParts.push("第一轮为信息收集阶段，下一轮应聚焦发现的关键资产进行深度探测")
  }
  if (toolsUsed.size <= 2 && round > 1) {
    directionParts.push("工具使用单一，建议扩展到其他能力维度")
  }
  const nextDirection = directionParts.length > 0 ? directionParts.join("; ") : "继续当前策略"

  return { keyFindings, lessonsLearned, nextDirection }
}

export async function shouldContinueAutoReplan(
  projectId: string,
  currentRound: number,
  maxRounds: number,
  lastPlanPayload: OrchestratorPlanPayload,
  lastExecution: DispatchPlanResult,
): Promise<{ shouldContinue: boolean; reason: string }> {
  // Stop condition 1: Max rounds reached
  if (currentRound >= maxRounds) {
    return { shouldContinue: false, reason: `已达到最大轮次限制 (${maxRounds})` }
  }

  // Stop condition 2: LLM returned empty items
  if (lastPlanPayload.plan.items.length === 0) {
    return { shouldContinue: false, reason: "LLM 判断当前结果已足够完整" }
  }

  // Stop condition 3: Execution blocked by approval
  if (lastExecution.status === "waiting_approval") {
    return { shouldContinue: false, reason: "有未处理的高风险审批，暂停自动规划" }
  }

  // Stop condition 4: All executions failed
  if (lastExecution.status === "blocked") {
    return { shouldContinue: false, reason: "本轮执行全部失败或阻塞" }
  }

  // Stop condition 5: High failure rate across all rounds
  const dbRounds = await prisma.orchestratorRound.findMany({
    where: { projectId },
    orderBy: { round: "asc" },
  })
  const rounds = dbRounds.map(toOrchestratorRoundRecord)

  const totalPlanned = rounds.reduce((sum, r) => sum + r.planItemCount, 0)
  if (totalPlanned > 0) {
    const failedTasks = await prisma.schedulerTask.count({
      where: { projectId, status: "failed" },
    })
    const failureRate = failedTasks / totalPlanned
    if (failureRate > 0.6 && currentRound >= 3) {
      return { shouldContinue: false, reason: `失败率过高 (${Math.round(failureRate * 100)}%)，已执行 ${currentRound} 轮，提前收敛` }
    }
  }

  // Stop condition 6: No progress (check last 2 rounds)
  if (rounds.length >= 2) {
    const lastTwo = rounds.slice(-2)
    const noProgress = lastTwo.every(
      (r) => r.newAssetCount === 0 && r.newFindingCount === 0 && r.newEvidenceCount === 0,
    )

    if (noProgress) {
      return { shouldContinue: false, reason: "连续 2 轮无新增资产/证据/发现" }
    }
  }

  // Stop condition 6: Check scheduler control (user may have paused/stopped)
  const control = await getStoredProjectSchedulerControl(projectId)

  if (!control || control.lifecycle !== "running" || control.paused) {
    return { shouldContinue: false, reason: "项目已被暂停或停止" }
  }

  return { shouldContinue: true, reason: "" }
}

export async function generateMultiRoundPlan(
  projectId: string,
  currentRound: number,
): Promise<OrchestratorPlanPayload | null> {
  const project = await getStoredProjectById(projectId)

  if (!project) {
    return null
  }

  const control = await getStoredProjectSchedulerControl(projectId)
  const availableTools = await getAvailableOrchestratorTools()
  const provider = await resolveLlmProvider()
  const providerStatus = await getConfiguredLlmProviderStatus()
  const fallbackItems = buildProjectFallbackPlanItems(project, availableTools, "replan")

  if (!provider) {
    console.warn(`[orchestrator] LLM 未配置，第${currentRound}轮无法生成真实计划。`)
    return null
  }

  const assets = await listStoredAssets(projectId)
  const evidence = await listStoredEvidence(projectId)
  const findings = await listStoredProjectFindings(projectId)
  const approvals = await listStoredProjectApprovals(projectId)

  const prompt = buildMultiRoundBrainPrompt({
    projectName: project.name,
    targetInput: project.targetInput,
    targets: project.targets,
    description: project.description,
    currentStage: project.stage,
    currentRound,
    maxRounds: control?.maxRounds ?? 5,
    autoReplan: control?.autoReplan ?? true,
    assetCount: assets.length,
    evidenceCount: evidence.length,
    findingCount: findings.length,
    pendingApprovals: approvals.filter((a) => a.status === "待处理").length,
    roundHistory: await buildCompressedRoundHistory(projectId),
    assetSnapshot: await buildAssetSnapshot(projectId),
    lastRoundDetail: await buildLastRoundDetail(projectId),
    unusedCapabilities: await buildUnusedCapabilities(projectId),
    failedToolsSummary: await buildFailedToolsSummary(projectId),
    availableTools,
  })

  const providerResult = await provider.generatePlan({
    prompt,
    purpose: "orchestrator",
    projectId,
  })

  const normalizedItems = filterPlanItemsToProjectScope(
    project,
    normalizePlanItems({
      availableTools,
      fallbackItems,
      items: providerResult.content.items,
      mode: "project",
    }),
  )

  const plan = await persistProjectOrchestratorPlan(
    projectId,
    normalizePlanRecord({
      items: normalizedItems,
      provider: provider.getStatus(),
      summary: providerResult.content.summary,
    }),
  )

  return { plan, provider: provider.getStatus() }
}
