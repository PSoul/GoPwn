import { getConfiguredLlmProviderStatus, resolveLlmProvider } from "@/lib/llm-provider/registry"
import { buildLocalLabPlanSummary, getLocalLabById, listLocalLabs } from "@/lib/local-lab-catalog"
import { dispatchProjectMcpRunAndDrain } from "@/lib/project-mcp-dispatch-service"
import { formatTimestamp } from "@/lib/prototype-record-utils"
import { getStoredProjectById } from "@/lib/project-repository"
import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import type {
  LocalValidationRunInput,
  LocalValidationRunPayload,
  LlmProviderStatus,
  OrchestratorPlanItem,
  OrchestratorPlanPayload,
  OrchestratorPlanRecord,
} from "@/lib/prototype-types"
import { upsertStoredWorkLogs } from "@/lib/work-log-repository"

function buildFallbackPlanItems(baseUrl: string, approvalScenario: "none" | "include-high-risk" = "include-high-risk") {
  const normalizedTarget = baseUrl
  const items: OrchestratorPlanItem[] = [
    {
      capability: "目标解析类",
      requestedAction: "标准化本地靶场目标",
      target: normalizedTarget,
      riskLevel: "低",
      rationale: "先把本地靶场的 URL 规范化，给后续调度一个稳定输入。",
    },
    {
      capability: "Web 页面探测类",
      requestedAction: "识别本地靶场入口与响应特征",
      target: normalizedTarget,
      riskLevel: "低",
      rationale: "先获取入口、标题和响应特征，确认调度与结果沉淀链路是通的。",
    },
  ]

  if (approvalScenario === "include-high-risk") {
    items.push({
      capability: "受控验证类",
      requestedAction: "受控登录绕过验证",
      target: `${normalizedTarget.replace(/\/+$/, "")}/login`,
      riskLevel: "高",
      rationale: "故意挂一条高风险动作，验证审批阻塞与恢复路径。",
    })
  }

  return items
}

function buildOrchestratorPrompt(input: {
  approvalScenario: "none" | "include-high-risk"
  baseUrl: string
  projectName: string
  projectStage: string
}) {
  return [
    `项目名称：${input.projectName}`,
    `项目阶段：${input.projectStage}`,
    `本地靶场 URL：${input.baseUrl}`,
    `审批场景：${input.approvalScenario === "include-high-risk" ? "需要包含一条高风险审批动作" : "只生成低风险动作"}`,
    "请返回最小闭环验证计划，优先选择目标解析类、Web 页面探测类、必要时再补一条高风险受控验证类。",
  ].join("\n")
}

function normalizePlanRecord(input: {
  items: OrchestratorPlanItem[]
  provider: LlmProviderStatus
  summary: string
}): OrchestratorPlanRecord {
  return {
    generatedAt: formatTimestamp(),
    provider: input.provider.provider,
    summary: input.summary,
    items: input.items,
  }
}

function getStoredProjectOrchestratorPlan(projectId: string) {
  return readPrototypeStore().orchestratorPlans[projectId] ?? null
}

function persistProjectOrchestratorPlan(projectId: string, plan: OrchestratorPlanRecord) {
  const store = readPrototypeStore()
  store.orchestratorPlans[projectId] = plan
  writePrototypeStore(store)

  return plan
}

export async function generateProjectOrchestratorPlan(
  projectId: string,
  input: LocalValidationRunInput,
): Promise<OrchestratorPlanPayload | null> {
  const project = getStoredProjectById(projectId)
  const localLab = await getLocalLabById(input.labId, { probe: true })

  if (!project || !localLab) {
    return null
  }

  const providerStatus = getConfiguredLlmProviderStatus()
  const provider = resolveLlmProvider()

  if (!provider) {
    const fallbackItems = buildFallbackPlanItems(localLab.baseUrl, input.approvalScenario ?? "include-high-risk")
    const plan = persistProjectOrchestratorPlan(
      projectId,
      normalizePlanRecord({
        items: fallbackItems,
        provider: providerStatus,
        summary: buildLocalLabPlanSummary(localLab, fallbackItems.length),
      }),
    )

    return {
      provider: providerStatus,
      plan,
    }
  }

  const providerResult = await provider.generatePlan({
    prompt: buildOrchestratorPrompt({
      approvalScenario: input.approvalScenario ?? "include-high-risk",
      baseUrl: localLab.baseUrl,
      projectName: project.name,
      projectStage: project.stage,
    }),
    purpose: "orchestrator",
  })
  const plan = persistProjectOrchestratorPlan(
    projectId,
    normalizePlanRecord({
      items: providerResult.content.items,
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
  const project = getStoredProjectById(projectId)
  const planPayload = await generateProjectOrchestratorPlan(projectId, input)

  if (!localLab || !project || !planPayload) {
    return null
  }

  const runs: LocalValidationRunPayload["runs"] = []

  upsertStoredWorkLogs([
    {
      id: `work-orchestrator-plan-${projectId}-${Date.now()}`,
      category: "LLM 编排",
      summary: `${localLab.name} 本地验证计划已生成，共 ${planPayload.plan.items.length} 条动作。`,
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
      runs,
      status: "blocked",
    }
  }

  for (const item of planPayload.plan.items) {
    const payload = await dispatchProjectMcpRunAndDrain(projectId, {
      capability: item.capability,
      requestedAction: item.requestedAction,
      target: item.target,
      riskLevel: item.riskLevel,
    })

    if (!payload) {
      return {
        provider: planPayload.provider,
        plan: planPayload.plan,
        localLab,
        runs,
        status: "blocked",
      }
    }

    runs.push(payload.run)

    if (payload.approval) {
      return {
        provider: planPayload.provider,
        plan: planPayload.plan,
        localLab,
        runs,
        status: "waiting_approval",
        approval: payload.approval,
      }
    }

    if (payload.run.status === "已阻塞") {
      return {
        provider: planPayload.provider,
        plan: planPayload.plan,
        localLab,
        runs,
        status: "blocked",
      }
    }
  }

  return {
    provider: planPayload.provider,
    plan: planPayload.plan,
    localLab,
    runs,
    status: "completed",
  }
}

export async function getProjectOrchestratorPanelPayload(projectId: string) {
  return {
    provider: getConfiguredLlmProviderStatus(),
    localLabs: await listLocalLabs(),
    lastPlan: getStoredProjectOrchestratorPlan(projectId),
  }
}
