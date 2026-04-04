import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { SettingsSubnav } from "@/components/settings/settings-subnav"
import { SystemStatusGrid } from "@/components/settings/system-status-grid"
import { requireAuth } from "@/lib/infra/auth"
import { getSystemStatus } from "@/lib/services/settings-service"

export default async function SystemStatusSettingsPage() {
  await requireAuth()
  const status = await getSystemStatus()

  const items = [
    { title: "数据库连接", value: status.database, description: "Prisma 连接状态" },
    { title: "MCP 工具", value: `${status.tools} 个已启用`, description: "已注册的探测工具" },
    { title: "MCP 服务端", value: `${status.servers} 个已启用`, description: "已注册的 MCP 服务" },
    { title: "LLM 配置", value: `${status.llmProfiles} 个`, description: "已配置的模型数量" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="系统状态"
        description="系统状态页呈现 MCP 网关、执行队列与 LLM 配置健康信息。"
      />

      <SettingsSubnav currentHref="/settings/system-status" />

      <SectionCard title="平台健康状态" description="核心面板健康摘要。">
        <SystemStatusGrid items={items} />
      </SectionCard>
    </div>
  )
}
