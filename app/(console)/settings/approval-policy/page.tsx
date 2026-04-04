import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { SettingsSubnav } from "@/components/settings/settings-subnav"
import { SystemControlPanel } from "@/components/settings/system-control-panel"
import { requireAuth } from "@/lib/infra/auth"
import { getGlobalConfig } from "@/lib/services/settings-service"

export default async function ApprovalPolicySettingsPage() {
  await requireAuth()
  const config = await getGlobalConfig()

  return (
    <div className="space-y-6">
      <PageHeader
        title="审批策略"
        description="审批是对 MCP 调用的风险闸门，单独放进策略页管理。"
      />

      <SettingsSubnav currentHref="/settings/approval-policy" />

      <SectionCard
        title="审批与范围控制"
        description="管理审批开关、默认放行模式与范围规则。"
      >
        <SystemControlPanel initialConfig={config ?? { id: "", approvalEnabled: true, autoApproveLowRisk: false, autoApproveMediumRisk: false }} />
      </SectionCard>
    </div>
  )
}
