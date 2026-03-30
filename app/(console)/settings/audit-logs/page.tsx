import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { SettingsLogTable } from "@/components/settings/settings-log-table"
import { SettingsSubnav } from "@/components/settings/settings-subnav"
import { listAuditLogsPayload } from "@/lib/prototype-api"

export default async function AuditLogsSettingsPage() {
  const { items: auditLogs } = await listAuditLogsPayload()

  return (
    <div className="space-y-6">
      <PageHeader
        title="审计日志"
        description="审计日志聚焦审批决策、系统切换、策略变更和人工接管，强调的是可回溯和责任边界。"
      />

      <SettingsSubnav currentHref="/settings/audit-logs" />

      <SectionCard title="审计事件" description="所有会改变平台执行边界的动作，都应该在这里被准确记录。">
        <SettingsLogTable logs={auditLogs} />
      </SectionCard>
    </div>
  )
}
