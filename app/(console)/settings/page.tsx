import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { SettingsHubGrid } from "@/components/settings/settings-hub-grid"
import { SettingsSubnav } from "@/components/settings/settings-subnav"
import { SystemStatusGrid } from "@/components/settings/system-status-grid"
import { requireAuth } from "@/lib/infra/auth"
import { getSystemStatus } from "@/lib/services/settings-service"

export default async function SettingsPage() {
  await requireAuth()
  const status = await getSystemStatus()

  const sections = [
    { title: "LLM 模型", description: "AI 规划、审阅与提取模型配置", href: "/settings/llm", metric: `${status.llmProfiles} 个配置`, tone: "info" as const },
    { title: "探测工具", description: "MCP 网关与工具注册管理", href: "/settings/mcp-tools", metric: `${status.tools} 个工具`, tone: status.tools > 0 ? "success" as const : "warning" as const },
    { title: "审批策略", description: "审批开关、放行模式与范围规则", href: "/settings/approval-policy", metric: "策略管理", tone: "neutral" as const },
    { title: "审计日志", description: "审批决策与系统变更记录", href: "/settings/audit-logs", metric: "日志查看", tone: "neutral" as const },
    { title: "系统状态", description: "MCP 网关、执行队列与健康检查", href: "/settings/system-status", metric: "健康检查", tone: "success" as const },
    { title: "用户管理", description: "平台用户账号与角色分配", href: "/settings/users", metric: "用户管理", tone: "neutral" as const },
  ]

  const statusCards = [
    { title: "数据库", value: status.database, description: "Prisma 连接正常" },
    { title: "MCP 工具", value: `${status.tools} 个`, description: `${status.servers} 个服务端` },
    { title: "LLM 配置", value: `${status.llmProfiles} 个`, description: "模型接入配置" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="系统设置"
        description="系统设置中心，各子类分别进入独立页面管理。"
      />

      <SettingsSubnav currentHref="/settings" />

      <SectionCard
        title="设置分类"
        eyebrow="Settings Hub"
        description="不同设置子类分别进入独立页面。"
      >
        <SettingsHubGrid sections={sections} />
      </SectionCard>

      <SectionCard
        title="系统状态预览"
        eyebrow="Health Snapshot"
        description="核心健康摘要。"
      >
        <SystemStatusGrid items={statusCards} />
      </SectionCard>
    </div>
  )
}
