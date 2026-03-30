import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { SettingsLogTable } from "@/components/settings/settings-log-table"
import { SettingsSubnav } from "@/components/settings/settings-subnav"
import { listWorkLogsPayload } from "@/lib/prototype-api"

export default async function WorkLogsSettingsPage() {
  const { items: workLogs } = await listWorkLogsPayload()

  return (
    <div className="space-y-6">
      <PageHeader
        title="工作日志"
        description="工作日志主要面向日常运行回放，帮助研究员回看每个项目里 LLM 和 MCP 到底已经做到了哪一步。"
      />

      <SettingsSubnav currentHref="/settings/work-logs" />

      <SectionCard title="执行工作日志" description="这里记录结果采集、资产归属、证据整理和调度处理等日常工作轨迹。">
        <SettingsLogTable logs={workLogs} />
      </SectionCard>
    </div>
  )
}
