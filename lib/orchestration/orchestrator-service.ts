import { buildLocalLabBrainPrompt, buildProjectBrainPrompt } from "@/lib/llm/llm-brain-prompt"
import { getConfiguredLlmProviderStatus, resolveLlmProvider } from "@/lib/llm-provider/registry"
import { buildLocalLabPlanSummary, getLocalLabById, listLocalLabs } from "@/lib/infra/local-lab-catalog"
import { listStoredAssets } from "@/lib/data/asset-repository"
import { listStoredEvidence } from "@/lib/data/evidence-repository"
import { listStoredProjectApprovals } from "@/lib/data/approval-repository"
import { formatTimestamp } from "@/lib/prototype-record-utils"
import { getStoredProjectById } from "@/lib/project/project-repository"
import { listStoredProjectFindings } from "@/lib/project/project-results-repository"
import {
  updateStoredProjectSchedulerControl,
} from "@/lib/project/project-scheduler-control-repository"
import { prisma } from "@/lib/infra/prisma"
import { discoverAndRegisterMcpServers } from "@/lib/mcp/mcp-auto-discovery"
import { upsertStoredWorkLogs } from "@/lib/data/work-log-repository"
import { filterPlanItemsToProjectScope } from "@/lib/orchestration/orchestrator-target-scope"
import {
  getAvailableOrchestratorTools,
  buildProjectFallbackPlanItems,
  normalizePlanItems,
  normalizePlanRecord,
  persistProjectOrchestratorPlan,
  getStoredProjectOrchestratorPlan,
} from "@/lib/orchestration/orchestrator-plan-builder"
import type { ProjectLifecyclePlanInput } from "@/lib/orchestration/orchestrator-plan-builder"
import {
  buildProjectRecentContext,
  executePlanItems,
  generateMultiRoundPlan,
  recordOrchestratorRound,
  settleProjectLifecycleClosure,
  shouldContinueAutoReplan,
} from "@/lib/orchestration/orchestrator-execution"
import { buildLocalLabFallbackPlanItems } from "@/lib/orchestration/orchestrator-local-lab"
import type {
  LocalValidationRunInput,
  LocalValidationRunPayload,
  OrchestratorPlanPayload,
} from "@/lib/prototype-types"

export async function generateProjectLifecyclePlan(
  projectId: string,
  input: ProjectLifecyclePlanInput,
): Promise<OrchestratorPlanPayload | null> {
  const project = await getStoredProjectById(projectId)

  if (!project) {
    return null
  }

  const availableTools = await getAvailableOrchestratorTools()
  const providerStatus = await getConfiguredLlmProviderStatus()
  const provider = await resolveLlmProvider()
  const fallbackItems = buildProjectFallbackPlanItems(project, availableTools, input.controlCommand)
  const assets = await listStoredAssets(projectId)
  const evidence = await listStoredEvidence(projectId)
  const findings = await listStoredProjectFindings(projectId)
  const approvals = await listStoredProjectApprovals(projectId)
  const recentContext = await buildProjectRecentContext(projectId)

  if (!provider) {
    console.warn(`[orchestrator] LLM 未配置，项目 ${projectId} 无法生成真实计划。请在设置页面配置 LLM。`)
    const plan = await persistProjectOrchestratorPlan(
      projectId,
      normalizePlanRecord({
        items: [],
        provider: providerStatus,
        summary: "LLM 未配置或未启用，无法生成计划。请在设置 → LLM 配置中填写 API Key、Base URL 和 Model。",
      }),
    )

    return { plan, provider: providerStatus }
  }

  const providerResult = await provider.generatePlan({
    prompt: buildProjectBrainPrompt({
      assetCount: assets.length,
      availableTools,
      controlCommand: input.controlCommand,
      currentStage: project.stage,
      description: project.description,
      evidenceCount: evidence.length,
      findingCount: findings.length,
      note: input.note,
      pendingApprovals: approvals.filter((approval) => approval.status === "待处理").length,
      projectName: project.name,
      recentContext,
      targetInput: project.targetInput,
      targets: project.targets,
    }),
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

  return {
    plan,
    provider: provider.getStatus(),
  }
}

export async function runProjectLifecycleKickoff(projectId: string, input: ProjectLifecyclePlanInput) {
  // Auto-discover and register MCP tools on project start
  if (input.controlCommand === "start") {
    try {
      await discoverAndRegisterMcpServers()
    } catch {
      // best-effort: continue even if discovery fails
    }
  }

  const project = await getStoredProjectById(projectId)
  const control = await prisma.projectSchedulerControl.findUnique({ where: { projectId } })

  // First round uses existing plan generation
  const planPayload = await generateProjectLifecyclePlan(projectId, input)

  if (!project || !planPayload) {
    return null
  }

  const startRound = (control?.currentRound ?? 0) + 1
  const maxRounds = control?.maxRounds ?? 5
  const autoReplan = control?.autoReplan ?? true

  // Update current round
  await updateStoredProjectSchedulerControl(projectId, {
    note: `第${startRound}轮 AI 规划已开始`,
  })

  const automaticItems = planPayload.plan.items.filter((item) => item.riskLevel !== "高")
  const highRiskItems = planPayload.plan.items.filter((item) => item.riskLevel === "高")

  upsertStoredWorkLogs([
    {
      id: `work-project-lifecycle-${projectId}-${Date.now()}`,
      category: "AI 规划",
      summary:
        input.controlCommand === "resume"
          ? `项目恢复后已重新生成 ${planPayload.plan.items.length} 条规划动作（第${startRound}轮），其中 ${automaticItems.length} 条低风险自动推进，${highRiskItems.length} 条高风险转入审批。`
          : `项目开始后已生成 ${planPayload.plan.items.length} 条首轮规划动作（第${startRound}轮），其中 ${automaticItems.length} 条低风险自动进入执行，${highRiskItems.length} 条高风险转入审批。`,
      projectName: project.name,
      actor: planPayload.provider.enabled ? "orchestrator-provider" : "orchestrator-fallback",
      timestamp: formatTimestamp(),
      status: "已完成",
    },
  ])

  // Execute first round
  const roundStartedAt = formatTimestamp()
  let execution = await executePlanItems(projectId, planPayload.plan.items)
  let currentPlanPayload = planPayload
  let currentRound = startRound

  // Record first round
  await recordOrchestratorRound(projectId, currentRound, roundStartedAt, execution, planPayload.plan.items.length)

  // Update round counter in scheduler control
  await prisma.projectSchedulerControl.updateMany({
    where: { projectId },
    data: { currentRound },
  })

  // Multi-round auto-replan loop
  if (autoReplan && execution.status === "completed") {
    while (currentRound < maxRounds) {
      const continueCheck = await shouldContinueAutoReplan(
        projectId,
        currentRound,
        maxRounds,
        currentPlanPayload,
        execution,
      )

      if (!continueCheck.shouldContinue) {
        upsertStoredWorkLogs([
          {
            id: `work-auto-replan-stop-${projectId}-${Date.now()}`,
            category: "AI 规划",
            summary: `自动续跑在第${currentRound}轮后停止: ${continueCheck.reason}`,
            projectName: project.name,
            actor: "orchestrator-auto-replan",
            timestamp: formatTimestamp(),
            status: "已完成",
          },
        ])
        break
      }

      currentRound += 1

      upsertStoredWorkLogs([
        {
          id: `work-auto-replan-${projectId}-${Date.now()}-r${currentRound}`,
          category: "AI 规划",
          summary: `自动续跑：开始第${currentRound}轮 AI 规划`,
          projectName: project.name,
          actor: "orchestrator-auto-replan",
          timestamp: formatTimestamp(),
          status: "进行中",
        },
      ])

      const nextPlan = await generateMultiRoundPlan(projectId, currentRound)

      if (!nextPlan || nextPlan.plan.items.length === 0) {
        upsertStoredWorkLogs([
          {
            id: `work-auto-replan-empty-${projectId}-${Date.now()}`,
            category: "AI 规划",
            summary: `第${currentRound}轮 LLM 返回空计划，自动收尾`,
            projectName: project.name,
            actor: "orchestrator-auto-replan",
            timestamp: formatTimestamp(),
            status: "已完成",
          },
        ])
        break
      }

      currentPlanPayload = nextPlan

      const nextRoundStart = formatTimestamp()
      execution = await executePlanItems(projectId, nextPlan.plan.items)

      await recordOrchestratorRound(projectId, currentRound, nextRoundStart, execution, nextPlan.plan.items.length)

      // Update round counter
      await prisma.projectSchedulerControl.updateMany({
        where: { projectId },
        data: { currentRound },
      })

      // If not completed (blocked/waiting_approval), stop the loop
      if (execution.status !== "completed") {
        break
      }
    }
  }

  // Final closure attempt
  if (execution.status === "completed") {
    await settleProjectLifecycleClosure(
      projectId,
      `项目在第${currentRound}轮后完成所有 AI 规划。`,
    )
  }

  return {
    ...currentPlanPayload,
    ...execution,
  }
}

export async function generateProjectOrchestratorPlan(
  projectId: string,
  input: LocalValidationRunInput,
): Promise<OrchestratorPlanPayload | null> {
  const project = await getStoredProjectById(projectId)
  const localLab = await getLocalLabById(input.labId, { probe: true })

  if (!project || !localLab) {
    return null
  }

  const availableTools = await getAvailableOrchestratorTools()
  const providerStatus = await getConfiguredLlmProviderStatus()
  const provider = await resolveLlmProvider()
  const fallbackItems = await buildLocalLabFallbackPlanItems(
    localLab.baseUrl,
    availableTools,
    input.approvalScenario ?? "include-high-risk",
  )

  if (!provider) {
    console.warn(`[orchestrator] LLM 未配置，项目 ${projectId} 本地靶场验证无法生成真实计划。`)
    const plan = await persistProjectOrchestratorPlan(
      projectId,
      normalizePlanRecord({
        items: fallbackItems,
        provider: providerStatus,
        summary: buildLocalLabPlanSummary(localLab, fallbackItems.length),
      }),
    )

    return { provider: providerStatus, plan }
  }

  const providerResult = await provider.generatePlan({
    prompt: buildLocalLabBrainPrompt({
      approvalScenario: input.approvalScenario ?? "include-high-risk",
      availableTools,
      baseUrl: localLab.baseUrl,
      projectName: project.name,
      projectStage: project.stage,
    }),
    purpose: "orchestrator",
    projectId,
  })
  const plan = await persistProjectOrchestratorPlan(
    projectId,
    normalizePlanRecord({
      items: normalizePlanItems({
        approvalScenario: input.approvalScenario ?? "include-high-risk",
        availableTools,
        fallbackItems,
        items: providerResult.content.items,
        mode: "local-lab",
      }),
      provider: provider.getStatus(),
      summary: providerResult.content.summary,
    }),
  )

  return {
    provider: provider.getStatus(),
    plan,
  }
}

export async function executeProjectLocalValidation(
  projectId: string,
  input: LocalValidationRunInput,
): Promise<LocalValidationRunPayload | null> {
  const localLab = await getLocalLabById(input.labId, { probe: true })
  const project = await getStoredProjectById(projectId)
  const planPayload = await generateProjectOrchestratorPlan(projectId, input)
  const schedulerControl = await updateStoredProjectSchedulerControl(projectId, {
    lifecycle: "running",
    note: "显式触发本地靶场闭环验证，项目已切换到运行态。",
  })

  if (!localLab || !project || !planPayload || (schedulerControl && "status" in schedulerControl)) {
    return null
  }

  upsertStoredWorkLogs([
    {
      id: `work-orchestrator-plan-${projectId}-${Date.now()}`,
      category: "AI 规划",
      summary: `${localLab.name} 本地验证计划已生成，共 ${planPayload.plan.items.length} 条动作。${localLab.statusNote ? ` ${localLab.statusNote}` : ""}`,
      projectName: project.name,
      actor: planPayload.provider.enabled ? "orchestrator-provider" : "orchestrator-fallback",
      timestamp: formatTimestamp(),
      status: "已完成",
    },
  ])

  if (localLab.status !== "online") {
    return {
      provider: planPayload.provider,
      plan: planPayload.plan,
      localLab,
      runs: [],
      status: "blocked",
    }
  }

  if (localLab.availability === "container") {
    upsertStoredWorkLogs([
      {
        id: `work-local-lab-container-${projectId}-${Date.now()}`,
        category: "本地靶场诊断",
        summary: `${localLab.name} 当前通过容器内可达性继续闭环。${localLab.statusNote}`,
        projectName: project.name,
        actor: "local-lab-catalog",
        timestamp: formatTimestamp(),
        status: "已完成",
      },
    ])
  }

  const execution = await executePlanItems(projectId, planPayload.plan.items, {
    ignoreProjectLifecycle: true,
  })

  if (execution.status === "completed") {
    await settleProjectLifecycleClosure(projectId, `${localLab.name} 本地闭环已跑空当前计划。`)
  }

  return {
    approval: execution.approval,
    localLab,
    plan: planPayload.plan,
    provider: planPayload.provider,
    runs: execution.runs,
    status: execution.status,
  }
}

export async function getProjectOrchestratorPanelPayload(projectId: string) {
  return {
    provider: await getConfiguredLlmProviderStatus(),
    localLabs: await listLocalLabs(),
    lastPlan: await getStoredProjectOrchestratorPlan(projectId),
  }
}
