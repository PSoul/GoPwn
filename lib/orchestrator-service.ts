import { listBuiltInMcpTools } from "@/lib/built-in-mcp-tools"
import { listStoredProjectApprovals } from "@/lib/approval-repository"
import { listStoredAssets } from "@/lib/asset-repository"
import { listStoredEvidence } from "@/lib/evidence-repository"
import { buildLocalLabBrainPrompt, buildProjectBrainPrompt } from "@/lib/llm-brain-prompt"
import {
  buildAssetSnapshot,
  buildCompressedRoundHistory,
  buildLastRoundDetail,
  buildMultiRoundBrainPrompt,
  buildUnusedCapabilities,
} from "@/lib/orchestrator-context-builder"
import { getConfiguredLlmProviderStatus, resolveLlmProvider } from "@/lib/llm-provider/registry"
import { buildLocalLabPlanSummary, getLocalLabById, listLocalLabs } from "@/lib/local-lab-catalog"
import { findStoredEnabledMcpServerByToolBinding } from "@/lib/mcp-server-repository"
import { listStoredMcpTools } from "@/lib/mcp-repository"
import { dispatchProjectMcpRunAndDrain } from "@/lib/project-mcp-dispatch-service"
import { formatTimestamp } from "@/lib/prototype-record-utils"
import { getStoredProjectById } from "@/lib/project-repository"
import {
  generateStoredProjectFinalConclusion,
  getStoredProjectReportExportPayload,
  listStoredProjectFindings,
} from "@/lib/project-results-repository"
import {
  getStoredProjectSchedulerControl,
  updateStoredProjectSchedulerControl,
} from "@/lib/project-scheduler-control-repository"
import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import type {
  ApprovalRecord,
  LocalValidationRunInput,
  LocalValidationRunPayload,
  LlmProviderStatus,
  McpRunRecord,
  McpToolRecord,
  OrchestratorPlanItem,
  OrchestratorPlanPayload,
  OrchestratorPlanRecord,
  OrchestratorRoundRecord,
  ProjectRecord,
} from "@/lib/prototype-types"
import { listStoredWorkLogs, upsertStoredWorkLogs } from "@/lib/work-log-repository"
import { listStoredSchedulerTasks } from "@/lib/mcp-scheduler-repository"
import { discoverAndRegisterMcpServers } from "@/lib/mcp-auto-discovery"

type ProjectLifecyclePlanInput = {
  controlCommand: "replan" | "resume" | "start"
  note?: string
}

type DispatchPlanResult = {
  approval?: ApprovalRecord
  runs: McpRunRecord[]
  status: "blocked" | "completed" | "waiting_approval"
}

function isWebGoatBaseUrl(baseUrl: string) {
  return /\/webgoat\/?$/i.test(baseUrl)
}

function canUseHttpStructureDiscovery(baseUrl: string) {
  return isWebGoatBaseUrl(baseUrl) && Boolean(findStoredEnabledMcpServerByToolBinding("graphql-surface-check"))
}

function uniqueTools(tools: McpToolRecord[]) {
  const seen = new Set<string>()

  return tools.filter((tool) => {
    const fingerprint = `${tool.capability}::${tool.toolName}`

    if (seen.has(fingerprint)) {
      return false
    }

    seen.add(fingerprint)
    return true
  })
}

function getAvailableOrchestratorTools() {
  return uniqueTools(
    [...listStoredMcpTools(), ...listBuiltInMcpTools()].filter((tool) => tool.status === "启用"),
  )
}

function findCapabilityByName(tools: McpToolRecord[], capability: string) {
  return tools.find((tool) => tool.capability === capability)?.capability ?? null
}

function findCapabilityByKeywords(tools: McpToolRecord[], keywords: string[]) {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase())

  return (
    tools.find((tool) =>
      normalizedKeywords.some((keyword) => tool.capability.toLowerCase().includes(keyword) || tool.toolName.toLowerCase().includes(keyword)),
    )?.capability ?? null
  )
}

function normalizeRiskLevel(rawRiskLevel: string | undefined, fallback: OrchestratorPlanItem["riskLevel"]) {
  const normalized = rawRiskLevel?.trim().toLowerCase()

  if (!normalized) {
    return fallback
  }

  if (["高", "high", "critical", "severe"].includes(normalized)) {
    return "高"
  }

  if (["中", "medium", "moderate"].includes(normalized)) {
    return "中"
  }

  if (["低", "low", "info", "informational", "passive"].includes(normalized)) {
    return "低"
  }

  return fallback
}

function normalizeTarget(rawTarget: string | undefined, fallback: string) {
  const trimmed = rawTarget?.trim()

  return trimmed?.length ? trimmed : fallback
}

function normalizeUrlTarget(target: string) {
  return target.trim().replace(/\/+$/, "")
}

function classifyTarget(target: string) {
  const trimmed = target.trim()

  if (/^https?:\/\//i.test(trimmed)) {
    return "url" as const
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}$/.test(trimmed)) {
    return "cidr" as const
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(trimmed)) {
    return "ip" as const
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) {
    return "domain" as const
  }

  return "other" as const
}

function extractHostCandidate(target: string) {
  const trimmed = target.trim()

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).hostname
    } catch {
      return trimmed
    }
  }

  return trimmed
}

function toWebTarget(target: string) {
  const trimmed = target.trim()

  if (/^https?:\/\//i.test(trimmed)) {
    return normalizeUrlTarget(trimmed)
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(trimmed)) {
    return `http://${trimmed}`
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) {
    return `https://${trimmed}`
  }

  return null
}

function isLocalHost(value: string) {
  return ["localhost", "127.0.0.1"].includes(value.trim().toLowerCase())
}

function ipv4ToNumber(ip: string) {
  const parts = ip.split(".").map((part) => Number(part))

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null
  }

  return parts.reduce((accumulator, part) => (accumulator << 8) + part, 0) >>> 0
}

function isIpv4InCidr(ip: string, cidr: string) {
  const [baseIp, rawMask] = cidr.split("/")
  const candidate = ipv4ToNumber(ip)
  const base = ipv4ToNumber(baseIp)
  const maskBits = Number(rawMask)

  if (candidate === null || base === null || Number.isNaN(maskBits) || maskBits < 0 || maskBits > 32) {
    return false
  }

  const mask = maskBits === 0 ? 0 : ((0xffffffff << (32 - maskBits)) >>> 0)

  return (candidate & mask) === (base & mask)
}

function extractComparableHost(target: string) {
  const trimmed = target.trim()

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).hostname.toLowerCase()
    } catch {
      return trimmed.toLowerCase()
    }
  }

  return trimmed.toLowerCase()
}

function isTargetWithinProjectScope(project: ProjectRecord, candidateTarget: string) {
  const candidate = candidateTarget.trim()

  if (!candidate) {
    return false
  }

  const candidateHost = extractComparableHost(candidate)
  const candidateType = classifyTarget(candidateHost)

  return project.targets.some((projectTarget) => {
    const normalizedProjectTarget = projectTarget.trim()
    const projectHost = extractComparableHost(normalizedProjectTarget)
    const projectType = classifyTarget(projectHost)

    if (candidate.toLowerCase() === normalizedProjectTarget.toLowerCase()) {
      return true
    }

    if (candidateHost === projectHost || (isLocalHost(candidateHost) && isLocalHost(projectHost))) {
      return true
    }

    if (projectType === "domain") {
      return candidateHost === projectHost || candidateHost.endsWith(`.${projectHost}`)
    }

    if (projectType === "url") {
      const urlHost = extractComparableHost(normalizedProjectTarget)

      if (isLocalHost(urlHost)) {
        return isLocalHost(candidateHost)
      }

      return candidateHost === urlHost
    }

    if (projectType === "ip") {
      return candidateType === "ip" ? candidateHost === projectHost : candidateHost === projectHost
    }

    if (projectType === "cidr") {
      return candidateType === "ip" ? isIpv4InCidr(candidateHost, projectHost) : isIpv4InCidr(candidateHost, projectHost)
    }

    return false
  })
}

function filterPlanItemsToProjectScope(project: ProjectRecord, items: OrchestratorPlanItem[]) {
  return items.filter((item) => isTargetWithinProjectScope(project, item.target))
}

function appendUniquePlanItem(collection: OrchestratorPlanItem[], item: OrchestratorPlanItem | null) {
  if (!item) {
    return
  }

  const fingerprint = `${item.capability}::${item.target}::${item.requestedAction}`

  if (collection.some((current) => `${current.capability}::${current.target}::${current.requestedAction}` === fingerprint)) {
    return
  }

  collection.push(item)
}

function buildProjectFallbackPlanItems(
  project: ProjectRecord,
  availableTools: McpToolRecord[],
  controlCommand: ProjectLifecyclePlanInput["controlCommand"],
) {
  const items: OrchestratorPlanItem[] = []
  const parseCapability = findCapabilityByName(availableTools, "目标解析类")
  const dnsCapability = findCapabilityByKeywords(availableTools, ["dns", "子域", "证书"])
  const webCapability = findCapabilityByKeywords(availableTools, ["web", "页面", "入口", "header", "surface"])
  const evidenceCapability = findCapabilityByKeywords(availableTools, ["截图", "证据", "capture", "snapshot"])
  const networkCapability = findCapabilityByKeywords(availableTools, ["端口", "服务", "网络", "扫描"])
  const targets = project.targets.slice(0, 4)
  const lifecycleReason =
    controlCommand === "resume"
      ? "项目从暂停恢复，需要基于当前结果继续补采而不是重复回放。"
      : controlCommand === "start"
        ? "项目刚手动开始，需要先把目标整理成可执行的低风险动作。"
        : "项目需要重新梳理下一步动作。"

  for (const target of targets) {
    const targetType = classifyTarget(target)
    const host = extractHostCandidate(target)
    const webTarget = toWebTarget(target)

    appendUniquePlanItem(
      items,
      parseCapability
        ? {
            capability: parseCapability,
            requestedAction: "标准化并分类项目目标",
            target,
            riskLevel: "低",
            rationale: `${lifecycleReason} 先统一目标格式，再决定后续由哪些 MCP 承接。`,
          }
        : null,
    )

    appendUniquePlanItem(
      items,
      dnsCapability && (targetType === "domain" || (targetType === "url" && classifyTarget(host) === "domain"))
        ? {
            capability: dnsCapability,
            requestedAction: "补采域名、子域与证书情报",
            target: host,
            riskLevel: "低",
            rationale: "域名类目标优先做被动情报收集，能快速扩展资产面且风险最低。",
          }
        : null,
    )

    appendUniquePlanItem(
      items,
      webCapability && webTarget
        ? {
            capability: webCapability,
            requestedAction: "识别 Web 入口与响应特征",
            target: webTarget,
            riskLevel: "低",
            rationale: "先识别页面入口、标题、响应头与可见路径，再决定是否需要更深一层动作。",
          }
        : null,
    )

    appendUniquePlanItem(
      items,
      evidenceCapability && webTarget
        ? {
            capability: evidenceCapability,
            requestedAction: "采集关键页面截图与 HTML 证据",
            target: webTarget,
            riskLevel: "低",
            rationale: "把关键页面上下文沉淀成可复核的截图和 HTML 快照，避免只有摘要没有原貌。",
          }
        : null,
    )

    appendUniquePlanItem(
      items,
      networkCapability && (targetType === "ip" || targetType === "cidr")
        ? {
            capability: networkCapability,
            requestedAction: "识别开放端口、协议与服务画像",
            target,
            riskLevel: "低",
            rationale: "IP 和网段目标优先沉淀网络面与服务面，为后续漏洞判断提供基础上下文。",
          }
        : null,
    )
  }

  return items.slice(0, 6)
}

function buildLocalLabFallbackPlanItems(
  baseUrl: string,
  availableTools: McpToolRecord[],
  approvalScenario: "none" | "include-high-risk" = "include-high-risk",
) {
  const normalizedTarget = normalizeUrlTarget(baseUrl)
  const webProbeTarget = isWebGoatBaseUrl(normalizedTarget) ? `${normalizedTarget}/login` : normalizedTarget
  const actuatorTarget = `${normalizedTarget}/actuator`
  const includeHttpStructure = canUseHttpStructureDiscovery(normalizedTarget)
  const parseCapability = findCapabilityByName(availableTools, "目标解析类")
  const webCapability = findCapabilityByKeywords(availableTools, ["web", "页面", "入口", "surface"])
  const evidenceCapability = findCapabilityByKeywords(availableTools, ["截图", "证据", "capture", "snapshot"])
  const structureCapability = includeHttpStructure
    ? findCapabilityByKeywords(availableTools, ["http", "api", "graphql", "swagger", "openapi", "actuator"])
    : null
  const validationCapability = findCapabilityByKeywords(availableTools, ["验证", "auth", "登录", "poc"])
  const items: OrchestratorPlanItem[] = []

  appendUniquePlanItem(
    items,
    parseCapability
      ? {
          capability: parseCapability,
          requestedAction: "标准化本地靶场目标",
          target: normalizedTarget,
          riskLevel: "低",
          rationale: "先把本地靶场 URL 规范化，给后续调度一个稳定输入。",
        }
      : null,
  )
  appendUniquePlanItem(
    items,
    webCapability
      ? {
          capability: webCapability,
          requestedAction: "识别本地靶场入口与响应特征",
          target: webProbeTarget,
          riskLevel: "低",
          rationale: "先获取入口、标题和响应特征，确认调度与结果沉淀链路是通的。",
        }
      : null,
  )
  appendUniquePlanItem(
    items,
    evidenceCapability
      ? {
          capability: evidenceCapability,
          requestedAction: "采集本地靶场关键页面截图与 HTML 证据",
          target: webProbeTarget,
          riskLevel: "低",
          rationale: "在进入后续验证前先沉淀真实页面上下文，便于确认登录页、入口和最终结果是否一致。",
        }
      : null,
  )

  if (structureCapability) {
    appendUniquePlanItem(items, {
      capability: structureCapability,
      requestedAction: "识别 WebGoat Actuator 结构入口",
      target: actuatorTarget,
      riskLevel: "低",
      rationale: "先以低风险方式确认 Actuator 结构入口和暴露信号，再决定是否进入审批验证。",
    })
  }

  if (approvalScenario === "include-high-risk" && validationCapability) {
    appendUniquePlanItem(items, {
      capability: validationCapability,
      requestedAction: isWebGoatBaseUrl(normalizedTarget) ? "验证 WebGoat Actuator 匿名暴露" : "受控登录绕过验证",
      target: isWebGoatBaseUrl(normalizedTarget) ? actuatorTarget : `${normalizedTarget}/login`,
      riskLevel: "高",
      rationale: isWebGoatBaseUrl(normalizedTarget)
        ? "对本地 WebGoat 的 Spring Actuator 暴露面执行审批后受控验证，检查真实 finding 闭环。"
        : "故意挂一条高风险动作，验证审批阻塞与恢复路径。",
    })
  }

  return items
}

function inferCapabilityFromItem(
  rawItem: Partial<OrchestratorPlanItem>,
  fallback: OrchestratorPlanItem,
  availableTools: McpToolRecord[],
) {
  if (rawItem.capability && availableTools.some((tool) => tool.capability === rawItem.capability)) {
    return rawItem.capability
  }

  const capabilityText = `${rawItem.capability ?? ""} ${rawItem.requestedAction ?? ""} ${rawItem.rationale ?? ""}`.toLowerCase()

  if (
    capabilityText.includes("目标解析") ||
    capabilityText.includes("标准化") ||
    capabilityText.includes("归一化") ||
    capabilityText.includes("normalize") ||
    capabilityText.includes("seed")
  ) {
    return findCapabilityByName(availableTools, "目标解析类") ?? fallback.capability
  }

  if (capabilityText.includes("dns") || capabilityText.includes("子域") || capabilityText.includes("证书")) {
    return findCapabilityByKeywords(availableTools, ["dns", "子域", "证书"]) ?? fallback.capability
  }

  if (
    capabilityText.includes("web") ||
    capabilityText.includes("入口") ||
    capabilityText.includes("页面") ||
    capabilityText.includes("标题") ||
    capabilityText.includes("header") ||
    capabilityText.includes("surface")
  ) {
    return findCapabilityByKeywords(availableTools, ["web", "页面", "入口", "header", "surface"]) ?? fallback.capability
  }

  if (
    capabilityText.includes("http") ||
    capabilityText.includes("api") ||
    capabilityText.includes("graphql") ||
    capabilityText.includes("swagger") ||
    capabilityText.includes("openapi") ||
    capabilityText.includes("actuator")
  ) {
    return findCapabilityByKeywords(availableTools, ["http", "api", "graphql", "swagger", "openapi", "actuator"]) ?? fallback.capability
  }

  if (
    capabilityText.includes("端口") ||
    capabilityText.includes("服务") ||
    capabilityText.includes("network") ||
    capabilityText.includes("scan")
  ) {
    return findCapabilityByKeywords(availableTools, ["端口", "服务", "网络", "扫描"]) ?? fallback.capability
  }

  if (
    capabilityText.includes("验证") ||
    capabilityText.includes("绕过") ||
    capabilityText.includes("auth") ||
    capabilityText.includes("登录") ||
    capabilityText.includes("poc")
  ) {
    return findCapabilityByKeywords(availableTools, ["验证", "auth", "登录", "poc", "漏洞"]) ?? fallback.capability
  }

  if (
    capabilityText.includes("截图") ||
    capabilityText.includes("证据") ||
    capabilityText.includes("capture") ||
    capabilityText.includes("snapshot")
  ) {
    return findCapabilityByKeywords(availableTools, ["截图", "证据", "capture", "snapshot"]) ?? fallback.capability
  }

  return fallback.capability
}

function buildNormalizedPlanItem(
  rawItem: Partial<OrchestratorPlanItem>,
  fallback: OrchestratorPlanItem,
  availableTools: McpToolRecord[],
): OrchestratorPlanItem {
  const capability = inferCapabilityFromItem(rawItem, fallback, availableTools)
  const requestedAction = rawItem.requestedAction?.trim() || fallback.requestedAction
  const rationale = rawItem.rationale?.trim() || fallback.rationale
  const target = normalizeTarget(rawItem.target, fallback.target)
  const validationCapability = findCapabilityByKeywords(availableTools, ["验证", "auth", "登录", "poc", "漏洞"])
  const riskLevel =
    validationCapability && capability === validationCapability
      ? normalizeRiskLevel(rawItem.riskLevel, fallback.riskLevel)
      : fallback.riskLevel

  // Preserve LLM-specified toolName if it matches a known tool
  const toolName = rawItem.toolName && availableTools.some((t) => t.toolName === rawItem.toolName)
    ? rawItem.toolName
    : undefined

  return {
    capability,
    requestedAction,
    target,
    riskLevel,
    rationale,
    toolName,
  }
}

function normalizePlanItems(
  input: {
    availableTools: McpToolRecord[]
    fallbackItems: OrchestratorPlanItem[]
    items: Partial<OrchestratorPlanItem>[] | undefined
    mode: "local-lab" | "project"
    approvalScenario?: "none" | "include-high-risk"
  },
) {
  const fallbackItems = input.fallbackItems

  if (fallbackItems.length === 0) {
    return []
  }

  const normalizedItems = (input.items ?? []).map((item, index) =>
    buildNormalizedPlanItem(item, fallbackItems[Math.min(index, fallbackItems.length - 1)], input.availableTools),
  )
  const filteredItems =
    input.mode === "local-lab" && input.approvalScenario === "none"
      ? normalizedItems.filter((item) => item.riskLevel !== "高")
      : normalizedItems

  for (const fallbackItem of fallbackItems) {
    if (
      filteredItems.some(
        (item) => item.capability === fallbackItem.capability && item.target === fallbackItem.target,
      )
    ) {
      continue
    }

    filteredItems.push(fallbackItem)
  }

  return filteredItems.filter((item, index, collection) => {
    const fingerprint = `${item.capability}::${item.target}::${item.requestedAction}`

    return collection.findIndex((candidate) => `${candidate.capability}::${candidate.target}::${candidate.requestedAction}` === fingerprint) === index
  })
}

function buildProjectRecentContext(projectId: string) {
  const store = readPrototypeStore()
  const project = store.projects.find((item) => item.id === projectId)

  if (!project) {
    return []
  }

  const assets = listStoredAssets(projectId)
  const evidence = listStoredEvidence(projectId)
  const findings = listStoredProjectFindings(projectId)
  const approvals = listStoredProjectApprovals(projectId)
  const workLogs = listStoredWorkLogs(project.name)
  const runs = store.mcpRuns.filter((run) => run.projectId === projectId)

  return [
    ...assets.slice(0, 2).map((asset) => `资产 ${asset.label} (${asset.type}) / ${asset.scopeStatus}`),
    ...findings.slice(0, 2).map((finding) => `发现 ${finding.title} / ${finding.severity} / ${finding.status}`),
    ...evidence.slice(0, 2).map((record) => `证据 ${record.title} / ${record.conclusion}`),
    ...approvals.slice(0, 2).map((approval) => `审批 ${approval.actionType} / ${approval.status}`),
    ...runs.slice(0, 2).map((run) => `调度 ${run.requestedAction} / ${run.status}`),
    ...workLogs.slice(0, 2).map((log) => `${log.category} / ${log.summary}`),
  ].slice(0, 8)
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

function hasActiveProjectSchedulerWork(projectId: string) {
  return listStoredSchedulerTasks(projectId).some((task) =>
    ["ready", "retry_scheduled", "delayed", "running", "waiting_approval"].includes(task.status),
  )
}

async function settleProjectLifecycleClosure(projectId: string, note?: string) {
  const project = getStoredProjectById(projectId)
  const schedulerControl = getStoredProjectSchedulerControl(projectId)

  if (!project || !schedulerControl) {
    return null
  }

  if (schedulerControl.lifecycle !== "running" || ["已停止", "已完成"].includes(project.status)) {
    return null
  }

  const pendingApprovals = listStoredProjectApprovals(projectId).filter((approval) => approval.status === "待处理")

  if (pendingApprovals.length > 0 || hasActiveProjectSchedulerWork(projectId)) {
    return null
  }

  const reportExport = getStoredProjectReportExportPayload(projectId)

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
        category: "项目收束",
        summary: note
          ? `${note} 项目已进入最终结论阶段并完成当前轮次收束。`
          : "项目已进入最终结论阶段并完成当前轮次收束。",
        projectName: project.name,
        actor: conclusion.source === "reviewer" ? "reviewer-provider" : "reviewer-fallback",
        timestamp: formatTimestamp(),
        status: "已完成",
      },
    ])
  }

  return conclusion
}

async function executePlanItems(
  projectId: string,
  items: OrchestratorPlanItem[],
  options?: {
    ignoreProjectLifecycle?: boolean
  },
): Promise<DispatchPlanResult> {
  const runs: McpRunRecord[] = []

  for (const item of items) {
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

    // Only approval blocking stops the round — individual tool failures are tolerated
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

export async function generateProjectLifecyclePlan(
  projectId: string,
  input: ProjectLifecyclePlanInput,
): Promise<OrchestratorPlanPayload | null> {
  const project = getStoredProjectById(projectId)

  if (!project) {
    return null
  }

  const availableTools = getAvailableOrchestratorTools()
  const providerStatus = getConfiguredLlmProviderStatus()
  const provider = resolveLlmProvider()
  const fallbackItems = buildProjectFallbackPlanItems(project, availableTools, input.controlCommand)
  const assets = listStoredAssets(projectId)
  const evidence = listStoredEvidence(projectId)
  const findings = listStoredProjectFindings(projectId)
  const approvals = listStoredProjectApprovals(projectId)
  const recentContext = buildProjectRecentContext(projectId)

  if (!provider) {
    const plan = persistProjectOrchestratorPlan(
      projectId,
      normalizePlanRecord({
        items: fallbackItems,
        provider: providerStatus,
        summary:
          input.controlCommand === "resume"
            ? `项目已恢复运行，使用本地回退策略生成 ${fallbackItems.length} 条续跑动作。`
            : `项目已开始，使用本地回退策略生成 ${fallbackItems.length} 条首轮动作。`,
      }),
    )

    return {
      plan,
      provider: providerStatus,
    }
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
  const plan = persistProjectOrchestratorPlan(
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

function recordOrchestratorRound(
  projectId: string,
  round: number,
  startedAt: string,
  execution: DispatchPlanResult,
  planItemCount: number,
): OrchestratorRoundRecord {
  const store = readPrototypeStore()
  const beforeAssets = listStoredAssets(projectId).length
  const beforeEvidence = listStoredEvidence(projectId).length
  const beforeFindings = listStoredProjectFindings(projectId).length

  const record: OrchestratorRoundRecord = {
    round,
    startedAt,
    completedAt: formatTimestamp(),
    planItemCount,
    executedCount: execution.runs.length,
    newAssetCount: listStoredAssets(projectId).length - Math.max(0, beforeAssets - execution.runs.length),
    newEvidenceCount: listStoredEvidence(projectId).length - Math.max(0, beforeEvidence - execution.runs.length),
    newFindingCount: listStoredProjectFindings(projectId).length - Math.max(0, beforeFindings - execution.runs.length),
    failedActions: execution.runs
      .filter((r) => r.status === "已阻塞")
      .map((r) => `${r.toolName}(${r.target})`),
    blockedByApproval: execution.approval ? [`${execution.approval.actionType}(${execution.approval.target})`] : [],
    summaryForNextRound: `第${round}轮执行${execution.runs.length}个动作`,
  }

  if (!store.orchestratorRounds[projectId]) {
    store.orchestratorRounds[projectId] = []
  }
  store.orchestratorRounds[projectId].push(record)
  writePrototypeStore(store)

  return record
}

function shouldContinueAutoReplan(
  projectId: string,
  currentRound: number,
  maxRounds: number,
  lastPlanPayload: OrchestratorPlanPayload,
  lastExecution: DispatchPlanResult,
): { shouldContinue: boolean; reason: string } {
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
    return { shouldContinue: false, reason: "有未处理的高风险审批，暂停自动编排" }
  }

  // Stop condition 4: All executions failed
  if (lastExecution.status === "blocked") {
    return { shouldContinue: false, reason: "本轮执行全部失败或阻塞" }
  }

  // Stop condition 5: No progress (check last 2 rounds)
  const store = readPrototypeStore()
  const rounds = store.orchestratorRounds[projectId] ?? []

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
  const control = getStoredProjectSchedulerControl(projectId)

  if (!control || control.lifecycle !== "running" || control.paused) {
    return { shouldContinue: false, reason: "项目已被暂停或停止" }
  }

  return { shouldContinue: true, reason: "" }
}

async function generateMultiRoundPlan(
  projectId: string,
  currentRound: number,
): Promise<OrchestratorPlanPayload | null> {
  const project = getStoredProjectById(projectId)

  if (!project) {
    return null
  }

  const control = getStoredProjectSchedulerControl(projectId)
  const availableTools = getAvailableOrchestratorTools()
  const provider = resolveLlmProvider()
  const providerStatus = getConfiguredLlmProviderStatus()
  const fallbackItems = buildProjectFallbackPlanItems(project, availableTools, "replan")

  if (!provider) {
    const plan = persistProjectOrchestratorPlan(
      projectId,
      normalizePlanRecord({
        items: fallbackItems,
        provider: providerStatus,
        summary: `第${currentRound}轮使用本地回退策略生成 ${fallbackItems.length} 条动作。`,
      }),
    )

    return { plan, provider: providerStatus }
  }

  const assets = listStoredAssets(projectId)
  const evidence = listStoredEvidence(projectId)
  const findings = listStoredProjectFindings(projectId)
  const approvals = listStoredProjectApprovals(projectId)

  const prompt = buildMultiRoundBrainPrompt({
    projectName: project.name,
    targetInput: project.targetInput,
    targets: project.targets,
    description: project.description,
    currentStage: project.stage,
    currentRound,
    maxRounds: control?.maxRounds ?? 10,
    autoReplan: control?.autoReplan ?? true,
    assetCount: assets.length,
    evidenceCount: evidence.length,
    findingCount: findings.length,
    pendingApprovals: approvals.filter((a) => a.status === "待处理").length,
    roundHistory: buildCompressedRoundHistory(projectId),
    assetSnapshot: buildAssetSnapshot(projectId),
    lastRoundDetail: buildLastRoundDetail(projectId),
    unusedCapabilities: buildUnusedCapabilities(projectId),
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

  const plan = persistProjectOrchestratorPlan(
    projectId,
    normalizePlanRecord({
      items: normalizedItems,
      provider: provider.getStatus(),
      summary: providerResult.content.summary,
    }),
  )

  return { plan, provider: provider.getStatus() }
}

export async function runProjectLifecycleKickoff(projectId: string, input: ProjectLifecyclePlanInput) {
  // Auto-discover and register MCP tools on project start
  if (input.controlCommand === "start") {
    try {
      discoverAndRegisterMcpServers()
    } catch {
      // best-effort: continue even if discovery fails
    }
  }

  const project = getStoredProjectById(projectId)
  const control = getStoredProjectSchedulerControl(projectId)

  // First round uses existing plan generation
  const planPayload = await generateProjectLifecyclePlan(projectId, input)

  if (!project || !planPayload) {
    return null
  }

  const startRound = (control?.currentRound ?? 0) + 1
  const maxRounds = control?.maxRounds ?? 10
  const autoReplan = control?.autoReplan ?? true

  // Update current round
  updateStoredProjectSchedulerControl(projectId, {
    note: `第${startRound}轮编排已开始`,
  })

  const automaticItems = planPayload.plan.items.filter((item) => item.riskLevel !== "高")
  const highRiskItems = planPayload.plan.items.filter((item) => item.riskLevel === "高")

  upsertStoredWorkLogs([
    {
      id: `work-project-lifecycle-${projectId}-${Date.now()}`,
      category: "LLM 编排",
      summary:
        input.controlCommand === "resume"
          ? `项目恢复后已重新生成 ${planPayload.plan.items.length} 条编排动作（第${startRound}轮），其中 ${automaticItems.length} 条低风险自动推进，${highRiskItems.length} 条高风险转入审批。`
          : `项目开始后已生成 ${planPayload.plan.items.length} 条首轮编排动作（第${startRound}轮），其中 ${automaticItems.length} 条低风险自动进入调度，${highRiskItems.length} 条高风险转入审批。`,
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
  recordOrchestratorRound(projectId, currentRound, roundStartedAt, execution, planPayload.plan.items.length)

  // Update round counter in scheduler control
  const store = readPrototypeStore()
  if (store.projectSchedulerControls[projectId]) {
    store.projectSchedulerControls[projectId].currentRound = currentRound
    writePrototypeStore(store)
  }

  // Multi-round auto-replan loop
  if (autoReplan && execution.status === "completed") {
    while (currentRound < maxRounds) {
      const continueCheck = shouldContinueAutoReplan(
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
            category: "LLM 编排",
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
          category: "LLM 编排",
          summary: `自动续跑：开始第${currentRound}轮编排`,
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
            category: "LLM 编排",
            summary: `第${currentRound}轮 LLM 返回空计划，自动收束`,
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

      recordOrchestratorRound(projectId, currentRound, nextRoundStart, execution, nextPlan.plan.items.length)

      // Update round counter
      const storeUpdate = readPrototypeStore()
      if (storeUpdate.projectSchedulerControls[projectId]) {
        storeUpdate.projectSchedulerControls[projectId].currentRound = currentRound
        writePrototypeStore(storeUpdate)
      }

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
      `项目在第${currentRound}轮后完成所有编排计划。`,
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
  const project = getStoredProjectById(projectId)
  const localLab = await getLocalLabById(input.labId, { probe: true })

  if (!project || !localLab) {
    return null
  }

  const availableTools = getAvailableOrchestratorTools()
  const providerStatus = getConfiguredLlmProviderStatus()
  const provider = resolveLlmProvider()
  const fallbackItems = buildLocalLabFallbackPlanItems(
    localLab.baseUrl,
    availableTools,
    input.approvalScenario ?? "include-high-risk",
  )

  if (!provider) {
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
  const plan = persistProjectOrchestratorPlan(
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
  const project = getStoredProjectById(projectId)
  const planPayload = await generateProjectOrchestratorPlan(projectId, input)
  const schedulerControl = updateStoredProjectSchedulerControl(projectId, {
    lifecycle: "running",
    note: "显式触发本地靶场闭环验证，项目已切换到运行态。",
  })

  if (!localLab || !project || !planPayload || (schedulerControl && "status" in schedulerControl)) {
    return null
  }

  upsertStoredWorkLogs([
    {
      id: `work-orchestrator-plan-${projectId}-${Date.now()}`,
      category: "LLM 编排",
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
    provider: getConfiguredLlmProviderStatus(),
    localLabs: await listLocalLabs(),
    lastPlan: getStoredProjectOrchestratorPlan(projectId),
  }
}
