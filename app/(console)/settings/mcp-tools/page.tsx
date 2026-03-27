import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { McpGatewayClient } from "@/components/settings/mcp-gateway-client"
import { SettingsSubnav } from "@/components/settings/settings-subnav"
import { getMcpSettingsPayload } from "@/lib/prototype-api"

export default function McpToolsSettingsPage() {
  const payload = getMcpSettingsPayload()

  return (
    <div className="space-y-6">
      <PageHeader
        title="MCP 工具管理"
        description="集中管理 MCP 工具注册信息、能力族、启停状态、默认限制与接入规范，先把网关骨架立起来。"
      />

      <SettingsSubnav currentHref="/settings/mcp-tools" />

      <SectionCard title="MCP 网关视图" description="这里不只展示工具列表，而是明确平台如何按能力契约、边界规则和注册规范来管理 MCP。">
        <McpGatewayClient
          initialTools={payload.tools}
          initialServers={payload.servers}
          initialInvocations={payload.recentInvocations}
          capabilities={payload.capabilities}
          boundaryRules={payload.boundaryRules}
          registrationFields={payload.registrationFields}
          initialServerContracts={payload.serverContracts}
          initialToolContracts={payload.toolContracts}
        />
      </SectionCard>
    </div>
  )
}
