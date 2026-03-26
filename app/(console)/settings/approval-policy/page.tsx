import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { SettingsSubnav } from "@/components/settings/settings-subnav"
import { SystemControlPanel } from "@/components/settings/system-control-panel"
import { getApprovalPolicyPayload } from "@/lib/prototype-api"

export default function ApprovalPolicySettingsPage() {
  const payload = getApprovalPolicyPayload()

  return (
    <div className="space-y-6">
      <PageHeader
        title="审批策略"
        description="审批在这个平台里是对 MCP 调用的风险闸门，而不是默认工作中心，所以单独放进策略页管理。"
      />

      <SettingsSubnav currentHref="/settings/approval-policy" />

      <SectionCard
        title="审批与范围控制"
        description="这里统一管理审批开关、默认放行模式、范围规则与紧急停止策略。"
      >
        <SystemControlPanel
          overview={payload.overview}
          approvalControl={payload.approvalControl}
          approvalPolicies={payload.approvalPolicies}
          scopeRules={payload.scopeRules}
        />
      </SectionCard>
    </div>
  )
}
