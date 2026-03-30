import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { LlmSettingsPanel } from "@/components/settings/llm-settings-panel"
import { SettingsSubnav } from "@/components/settings/settings-subnav"
import { listStoredLlmProfiles } from "@/lib/llm-settings-repository"

export default async function LlmSettingsPage() {
  const profiles = await listStoredLlmProfiles()
  const payload = { profiles }

  return (
    <div className="space-y-6">
      <PageHeader
        title="LLM 设置"
        description="这里维护真实的模型接入配置，不把 LLM 当首页聊天入口，而是把它作为后端编排、审阅和提取能力来参数化管理。"
      />

      <SettingsSubnav currentHref="/settings/llm" />

      <SectionCard title="模型接入与角色分工" description="把主编排、结果审阅和轻量提取拆开配置，并允许每个角色单独维护真实模型参数。">
        <LlmSettingsPanel initialProfiles={payload.profiles} />
      </SectionCard>
    </div>
  )
}
