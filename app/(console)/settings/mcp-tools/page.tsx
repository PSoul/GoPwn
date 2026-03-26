import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { McpToolTable } from "@/components/settings/mcp-tool-table"
import { SettingsSubnav } from "@/components/settings/settings-subnav"
import { mcpTools } from "@/lib/prototype-data"

export default function McpToolsSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="MCP 工具管理"
        description="集中管理工具风险级别、启停状态、并发与速率限制，明确平台当前到底能调什么工具。"
      />

      <SettingsSubnav currentHref="/settings/mcp-tools" />

      <SectionCard title="能力与工具面板" description="风险高、健康异常或策略受限的工具会先在这里被识别出来。">
        <McpToolTable tools={mcpTools} />
      </SectionCard>
    </div>
  )
}
