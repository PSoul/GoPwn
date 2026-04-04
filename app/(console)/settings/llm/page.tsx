import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { LlmSettingsPanel } from "@/components/settings/llm-settings-panel"
import { SettingsSubnav } from "@/components/settings/settings-subnav"
import { requireAuth } from "@/lib/infra/auth"
import { getLlmProfiles } from "@/lib/services/settings-service"

export default async function LlmSettingsPage() {
  await requireAuth()
  const profiles = await getLlmProfiles()

  return (
    <div className="space-y-6">
      <PageHeader
        title="LLM 设置"
        description="维护模型接入配置，把 LLM 作为后端规划、审阅和提取能力来参数化管理。"
      />

      <SettingsSubnav currentHref="/settings/llm" />

      <SectionCard title="模型接入与角色分工" description="把主规划、结果审阅和轻量提取拆开配置，并允许每个角色单独维护模型参数。">
        <LlmSettingsPanel initialProfiles={profiles} />
      </SectionCard>
    </div>
  )
}
