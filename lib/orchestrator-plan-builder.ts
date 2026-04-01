import { listBuiltInMcpTools } from "@/lib/built-in-mcp-tools"
import { listStoredMcpTools } from "@/lib/mcp-repository"
import { formatTimestamp } from "@/lib/prototype-record-utils"
import { classifyTarget, extractHostCandidate, toWebTarget, parseTcpTarget } from "@/lib/orchestrator-target-scope"
import { prisma } from "@/lib/prisma"
import { toOrchestratorPlanRecord, fromOrchestratorPlanRecord } from "@/lib/prisma-transforms"
import type { LlmProviderStatus, McpToolRecord, OrchestratorPlanItem, OrchestratorPlanRecord, ProjectRecord } from "@/lib/prototype-types"

export type ProjectLifecyclePlanInput = {
  controlCommand: "replan" | "resume" | "start"
  note?: string
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

  // Preserve LLM-generated code for execute_code/execute_command
  const code = typeof rawItem.code === "string" && rawItem.code.trim() ? rawItem.code.trim() : undefined

  return {
    capability,
    requestedAction,
    target,
    riskLevel,
    rationale,
    toolName,
    code,
  }
}

export async function getAvailableOrchestratorTools() {
  return uniqueTools(
    [...await listStoredMcpTools(), ...listBuiltInMcpTools()].filter((tool) => tool.status === "启用"),
  )
}

export function findCapabilityByName(tools: McpToolRecord[], capability: string) {
  return tools.find((tool) => tool.capability === capability)?.capability ?? null
}

export function findCapabilityByKeywords(tools: McpToolRecord[], keywords: string[]) {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase())

  return (
    tools.find((tool) =>
      normalizedKeywords.some((keyword) => tool.capability.toLowerCase().includes(keyword) || tool.toolName.toLowerCase().includes(keyword)),
    )?.capability ?? null
  )
}

export function findNetworkCapability(availableTools: McpToolRecord[]) {
  return findCapabilityByKeywords(availableTools, ["tcp", "banner", "netcat", "端口", "网络"])
}

export function appendUniquePlanItem(collection: OrchestratorPlanItem[], item: OrchestratorPlanItem | null) {
  if (!item) {
    return
  }

  const fingerprint = `${item.capability}::${item.target}::${item.requestedAction}`

  if (collection.some((current) => `${current.capability}::${current.target}::${current.requestedAction}` === fingerprint)) {
    return
  }

  collection.push(item)
}

export function normalizePlanItems(
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

  // LLM 生成的计划是权威的，不再自动合并 fallback items
  // fallbackItems 仅在 LLM 未配置时作为独立 fallback 使用（但那条路径现在会抛错）

  return filteredItems.filter((item, index, collection) => {
    const fingerprint = `${item.capability}::${item.target}::${item.requestedAction}`

    return collection.findIndex((candidate) => `${candidate.capability}::${candidate.target}::${candidate.requestedAction}` === fingerprint) === index
  })
}

export function buildProjectFallbackPlanItems(
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
      ? "项目从暂停恢复，需要基于当前结果继续采集而不是重复执行。"
      : controlCommand === "start"
        ? "项目刚启动，需要先把目标整理成可执行的低风险动作。"
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
            requestedAction: "采集域名、子域与证书情报",
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

    const tcpParsed = parseTcpTarget(target)

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

    // TCP targets (tcp://host:port or host:port) get banner grab
    const tcpNetCapability = findNetworkCapability(availableTools)

    appendUniquePlanItem(
      items,
      tcpNetCapability && tcpParsed
        ? {
            capability: tcpNetCapability,
            requestedAction: "TCP Banner 抓取，识别服务类型与版本",
            target: `${tcpParsed.host}:${tcpParsed.port}`,
            riskLevel: "低",
            rationale: "TCP 服务类目标优先做 banner 抓取，快速确认服务类型和版本信息。",
          }
        : null,
    )
  }

  return items.slice(0, 6)
}

export function buildTcpLabFallbackPlanItems(
  baseUrl: string,
  availableTools: McpToolRecord[],
  approvalScenario: "none" | "include-high-risk",
) {
  const parsed = parseTcpTarget(baseUrl)

  if (!parsed) {
    return []
  }

  const tcpTarget = `${parsed.host}:${parsed.port}`
  const networkCapability = findNetworkCapability(availableTools)
  const scanCapability = findCapabilityByKeywords(availableTools, ["端口", "扫描", "fscan", "port"])
  const bruteCapability = findCapabilityByKeywords(availableTools, ["爆破", "brute", "弱口令"])
  const items: OrchestratorPlanItem[] = []

  appendUniquePlanItem(
    items,
    networkCapability
      ? {
          capability: networkCapability,
          requestedAction: "TCP Banner 抓取，识别服务类型与版本",
          target: tcpTarget,
          riskLevel: "低",
          rationale: "TCP 服务类目标优先做 banner 抓取，快速确认服务类型和版本信息。",
        }
      : null,
  )

  appendUniquePlanItem(
    items,
    scanCapability
      ? {
          capability: scanCapability,
          requestedAction: "端口扫描确认服务状态",
          target: parsed.host,
          riskLevel: "中",
          rationale: "在 banner 抓取基础上扫描端口，确认服务开放状态和可能的附加服务。",
        }
      : null,
  )

  if (approvalScenario === "include-high-risk" && bruteCapability) {
    appendUniquePlanItem(items, {
      capability: bruteCapability,
      requestedAction: "弱口令爆破验证",
      target: tcpTarget,
      riskLevel: "高",
      rationale: "对已确认的 TCP 服务执行审批后受控弱口令检测，验证发现闭环。",
    })
  }

  return items
}

export function normalizePlanRecord(input: {
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

export async function getStoredProjectOrchestratorPlan(projectId: string) {
  const row = await prisma.orchestratorPlan.findUnique({ where: { projectId } })
  return row ? toOrchestratorPlanRecord(row) : null
}

export async function persistProjectOrchestratorPlan(projectId: string, plan: OrchestratorPlanRecord) {
  const data = fromOrchestratorPlanRecord(plan, projectId)
  await prisma.orchestratorPlan.upsert({
    where: { projectId },
    create: data,
    update: data,
  })

  return plan
}
