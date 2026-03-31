import { findStoredEnabledMcpServerByToolBinding } from "@/lib/mcp-server-repository"
import { isWebGoatBaseUrl, normalizeUrlTarget } from "@/lib/orchestrator-target-scope"
import {
  appendUniquePlanItem,
  buildTcpLabFallbackPlanItems,
  findCapabilityByKeywords,
  findCapabilityByName,
} from "@/lib/orchestrator-plan-builder"
import type { McpToolRecord, OrchestratorPlanItem } from "@/lib/prototype-types"

async function canUseHttpStructureDiscovery(baseUrl: string) {
  return isWebGoatBaseUrl(baseUrl) && Boolean(await findStoredEnabledMcpServerByToolBinding("graphql-surface-check"))
}

export async function buildLocalLabFallbackPlanItems(
  baseUrl: string,
  availableTools: McpToolRecord[],
  approvalScenario: "none" | "include-high-risk" = "include-high-risk",
) {
  // TCP targets get a different plan shape
  if (/^tcp:\/\//i.test(baseUrl)) {
    return buildTcpLabFallbackPlanItems(baseUrl, availableTools, approvalScenario)
  }

  const normalizedTarget = normalizeUrlTarget(baseUrl)
  const webProbeTarget = isWebGoatBaseUrl(normalizedTarget) ? `${normalizedTarget}/login` : normalizedTarget
  const actuatorTarget = `${normalizedTarget}/actuator`
  const includeHttpStructure = await canUseHttpStructureDiscovery(normalizedTarget)
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
