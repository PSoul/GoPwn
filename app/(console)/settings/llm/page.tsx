import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { LlmSettingsPanel } from "@/components/settings/llm-settings-panel"
import { SettingsSubnav } from "@/components/settings/settings-subnav"
import { llmSettings } from "@/lib/prototype-data"

export default function LlmSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="LLM 设置"
        description="这里定义平台里不同模型各自负责什么，不把 LLM 当首页交互，而是当后端编排与审阅能力来配置。"
      />

      <SettingsSubnav currentHref="/settings/llm" />

      <SectionCard title="模型职责与预算" description="把主编排、结果审阅和轻量提取拆开管理，避免所有任务都压在同一模型上。">
        <LlmSettingsPanel items={llmSettings} />
      </SectionCard>
    </div>
  )
}
