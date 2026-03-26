import { Settings2, ShieldCheck, SlidersHorizontal, Workflow } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { McpToolTable } from "@/components/settings/mcp-tool-table"
import { SystemControlPanel } from "@/components/settings/system-control-panel"
import { approvalPolicies, mcpTools, scopeRules, systemControlOverview } from "@/lib/prototype-data"

const statIcons = [Settings2, Workflow, ShieldCheck, SlidersHorizontal]

export default function SettingsPage() {
  const abnormalCount = mcpTools.filter((tool) => tool.status === "异常").length

  const stats = [
    { label: "MCP 工具数", value: String(mcpTools.length), detail: "能力层状态要持续可见，而不是只藏在日志里。" },
    { label: "异常工具", value: String(abnormalCount), detail: "异常工具需要立刻影响审批与调度策略。" },
    { label: "审批策略", value: String(approvalPolicies.length), detail: "高风险动作的默认规则都应该在这里可回看。" },
    { label: "范围规则", value: String(scopeRules.length), detail: "新增资产纳入与否，必须受统一范围规则约束。" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="系统设置"
        description="系统设置页不是普通偏好设置，而是平台控制台。研究员要在这里感知 MCP 能力、审批策略、范围规则和紧急停止状态。"
        actions={
          <>
            <StatusBadge tone={abnormalCount > 0 ? "danger" : "success"}>
              {abnormalCount > 0 ? `${abnormalCount} 个异常工具` : "工具健康"}
            </StatusBadge>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = statIcons[index]

          return (
            <div
              key={stat.label}
              className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_12px_40px_-32px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-950/70"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{stat.label}</p>
                  <p className="text-3xl font-semibold text-slate-950 dark:text-white">{stat.value}</p>
                </div>
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{stat.detail}</p>
            </div>
          )
        })}
      </div>

      <SectionCard
        title="MCP 工具管理"
        eyebrow="Capability Plane"
        description="这里集中显示所有能力的风险等级、并发、速率限制、超时重试和健康状态。"
      >
        <McpToolTable tools={mcpTools} />
      </SectionCard>

      <SectionCard
        title="平台控制总览"
        eyebrow="Control Console"
        description="把默认并发、审批策略、范围规则和紧急停止统一放在一页，不让关键控制散落在隐蔽角落。"
      >
        <SystemControlPanel
          overview={systemControlOverview}
          approvalPolicies={approvalPolicies}
          scopeRules={scopeRules}
        />
      </SectionCard>
    </div>
  )
}
