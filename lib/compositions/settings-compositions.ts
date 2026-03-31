import {
  mcpBoundaryRules,
  mcpCapabilityRecords,
  mcpRegistrationFields,
  settingsSections,
} from "@/lib/platform-config"
import { listStoredLlmProfiles } from "@/lib/llm-settings-repository"
import { getStoredGlobalApprovalControl } from "@/lib/approval-repository"
import {
  listStoredMcpServerInvocations,
  listStoredMcpServers,
} from "@/lib/mcp-server-repository"
import {
  listStoredMcpTools,
} from "@/lib/mcp-repository"
import {
  listStoredAuditLogs,
} from "@/lib/project-repository"
import { prisma } from "@/lib/prisma"
import { listStoredWorkLogs } from "@/lib/work-log-repository"
import type {
  LlmProfileRecord,
  McpResultMapping,
  McpSettingsPayload,
  McpToolRecord,
  SettingsSectionsPayload,
} from "@/lib/prototype-types"

// ──────────────────────────────────────────────
// Private helpers
// ──────────────────────────────────────────────

function buildMcpSettingsMetric(tools: McpToolRecord[]) {
  const enabledCount = tools.filter((tool) => tool.status === "启用").length
  const abnormalCount = tools.filter((tool) => tool.status === "异常").length

  return `${enabledCount} 启用 / ${abnormalCount} 异常`
}

function buildLlmSettingsMetric(profiles: LlmProfileRecord[]) {
  const enabledProfiles = profiles.filter((profile) => profile.enabled && profile.model).length

  return enabledProfiles > 0 ? `${enabledProfiles} 套已启用` : "等待配置"
}

function buildCapabilityPayloadFromTools(tools: McpToolRecord[]) {
  return mcpCapabilityRecords.map((capability) => ({
    ...capability,
    connectedTools: tools.filter((tool) => tool.capability === capability.name).map((tool) => tool.toolName),
  }))
}

// ──────────────────────────────────────────────
// Exported
// ──────────────────────────────────────────────

export async function getSettingsSectionsPayload(): Promise<SettingsSectionsPayload> {
  const auditTotal = (await listStoredAuditLogs()).length
  const approvalControl = await getStoredGlobalApprovalControl()
  const llmProfiles = await listStoredLlmProfiles()
  const mcpTools = await listStoredMcpTools()
  const workLogTotal = (await listStoredWorkLogs()).length

  return {
    items: settingsSections.map((section) => {
      if (section.href === "/settings/mcp-tools") {
        return {
          ...section,
          metric: buildMcpSettingsMetric(mcpTools),
        }
      }

      if (section.href === "/settings/llm") {
        return {
          ...section,
          metric: buildLlmSettingsMetric(llmProfiles),
        }
      }

      if (section.href === "/settings/approval-policy") {
        return {
          ...section,
          metric: approvalControl.enabled ? "高风险审批开启" : "审批临时关闭",
        }
      }

      if (section.href === "/settings/audit-logs") {
        return {
          ...section,
          metric: `${auditTotal} 条审计记录`,
        }
      }

      if (section.href === "/settings/work-logs") {
        return {
          ...section,
          metric: `${workLogTotal} 条工作日志`,
        }
      }

      return section
    }),
    total: settingsSections.length,
  }
}

export async function getMcpSettingsPayload(): Promise<McpSettingsPayload> {
  const tools = await listStoredMcpTools()
  const dbServerContracts = await prisma.mcpServerContract.findMany()
  const dbToolContracts = await prisma.mcpToolContract.findMany()

  return {
    tools,
    servers: await listStoredMcpServers(),
    recentInvocations: await listStoredMcpServerInvocations(undefined, 6),
    capabilities: buildCapabilityPayloadFromTools(tools),
    boundaryRules: mcpBoundaryRules,
    registrationFields: mcpRegistrationFields,
    serverContracts: dbServerContracts.map((row) => ({
      serverId: row.serverId,
      serverName: row.serverName,
      version: row.version,
      transport: row.transport as "stdio" | "streamable_http" | "sse",
      enabled: row.enabled,
      toolNames: row.toolNames,
      command: row.command ?? undefined,
      endpoint: row.endpoint,
      projectId: row.projectId ?? undefined,
      updatedAt: row.updatedAt.toISOString(),
    })),
    toolContracts: dbToolContracts.map((row) => ({
      serverId: row.serverId,
      serverName: row.serverName,
      toolName: row.toolName,
      title: row.title,
      capability: row.capability,
      boundary: row.boundary as "外部目标交互" | "平台内部处理" | "外部第三方API",
      riskLevel: row.riskLevel as "高" | "中" | "低",
      requiresApproval: row.requiresApproval,
      resultMappings: row.resultMappings as McpResultMapping[],
      projectId: row.projectId ?? undefined,
      updatedAt: row.updatedAt.toISOString(),
    })),
  }
}
