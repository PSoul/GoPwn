import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { McpGatewayClient } from "@/components/settings/mcp-gateway-client"
import { SettingsSubnav } from "@/components/settings/settings-subnav"
import * as mcpToolRepo from "@/lib/repositories/mcp-tool-repo"

export default async function McpToolsSettingsPage() {
  const [tools, servers] = await Promise.all([
    mcpToolRepo.findAll(),
    mcpToolRepo.findAllServers(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="探测工具管理"
        description="集中管理探测工具注册信息、能力族、启停状态与接入规范。"
      />

      <SettingsSubnav currentHref="/settings/mcp-tools" />

      <SectionCard title="MCP 网关视图" description="平台按能力契约、边界规则和注册规范来管理 MCP 工具。">
        <McpGatewayClient
          initialTools={tools}
          initialServers={servers}
        />
      </SectionCard>
    </div>
  )
}
