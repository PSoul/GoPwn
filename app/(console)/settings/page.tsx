import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { SettingsHubGrid } from "@/components/settings/settings-hub-grid"
import { SettingsSubnav } from "@/components/settings/settings-subnav"
import { SystemStatusGrid } from "@/components/settings/system-status-grid"
import { getSettingsSectionsPayload, getSystemStatusPayload } from "@/lib/infra/api-compositions"

export default async function SettingsPage() {
  const { items: sections } = await getSettingsSectionsPayload()
  const { items: statusCards } = await getSystemStatusPayload()

  return (
    <div className="space-y-6">
      <PageHeader
        title="系统设置"
        description="系统设置改成设置中心，不再把 MCP、LLM、审批、日志和系统状态全部堆在一张长页面里。"
      />

      <SettingsSubnav currentHref="/settings" />

      <SectionCard
        title="设置分类"
        eyebrow="Settings Hub"
        description="不同设置子类分别进入独立页面，保证研究员能在明确语境里处理工具、模型、审批、日志和系统状态。"
      >
        <SettingsHubGrid sections={sections} />
      </SectionCard>

      <SectionCard
        title="系统状态预览"
        eyebrow="Health Snapshot"
        description="在设置中心先看到核心健康摘要，再决定是否深入到具体子页。"
      >
        <SystemStatusGrid items={statusCards} />
      </SectionCard>
    </div>
  )
}
