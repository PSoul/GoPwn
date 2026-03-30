import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { SettingsSubnav } from "@/components/settings/settings-subnav"
import { SystemStatusGrid } from "@/components/settings/system-status-grid"
import { getSystemStatusPayload } from "@/lib/api-compositions"

export default async function SystemStatusSettingsPage() {
  const { items } = await getSystemStatusPayload()

  return (
    <div className="space-y-6">
      <PageHeader
        title="系统状态"
        description="系统状态页单独呈现 MCP 网关、调度队列、浏览器池和日志存储，让研究员不用在设置大页里来回找健康信息。"
      />

      <SettingsSubnav currentHref="/settings/system-status" />

      <SectionCard title="平台健康状态" description="先看四个核心面板，再决定是否进入更细的巡检流程。">
        <SystemStatusGrid items={items} />
      </SectionCard>
    </div>
  )
}
