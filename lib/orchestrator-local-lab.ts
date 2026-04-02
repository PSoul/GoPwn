import { findStoredEnabledMcpServerByToolBinding } from "@/lib/mcp-server-repository"
import { normalizeUrlTarget } from "@/lib/orchestrator-target-scope"
import {
  appendUniquePlanItem,
  buildTcpLabFallbackPlanItems,
  findCapabilityByKeywords,
  findCapabilityByName,
} from "@/lib/orchestrator-plan-builder"
import type { McpToolRecord, OrchestratorPlanItem } from "@/lib/prototype-types"

async function canUseHttpStructureDiscovery() {
  return Boolean(await findStoredEnabledMcpServerByToolBinding("graphql-surface-check"))
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
  const includeHttpStructure = await canUseHttpStructureDiscovery()
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
          requestedAction: "标准化目标",
          target: normalizedTarget,
          riskLevel: "低",
          rationale: "先把目标 URL 规范化，给后续调度一个稳定输入。",
        }
      : null,
  )
  appendUniquePlanItem(
    items,
    webCapability
      ? {
          capability: webCapability,
          requestedAction: "识别目标入口与响应特征",
          target: normalizedTarget,
          riskLevel: "低",
          rationale: "获取入口、标题和响应特征，确认调度与结果沉淀链路。",
        }
      : null,
  )
  appendUniquePlanItem(
    items,
    evidenceCapability
      ? {
          capability: evidenceCapability,
          requestedAction: "采集目标关键页面截图与 HTML 证据",
          target: normalizedTarget,
          riskLevel: "低",
          rationale: "在进入后续验证前先沉淀真实页面上下文。",
        }
      : null,
  )

  if (structureCapability) {
    appendUniquePlanItem(items, {
      capability: structureCapability,
      requestedAction: "识别 HTTP/API 结构入口",
      target: normalizedTarget,
      riskLevel: "低",
      rationale: "以低风险方式探测结构入口和暴露信号。",
    })
  }

  if (approvalScenario === "include-high-risk" && validationCapability) {
    appendUniquePlanItem(items, {
      capability: validationCapability,
      requestedAction: "受控安全验证",
      target: normalizedTarget,
      riskLevel: "高",
      rationale: "挂一条高风险动作，验证审批阻塞与恢复路径。",
    })
  }

  return items
}
