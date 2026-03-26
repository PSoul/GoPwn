import {
  Activity,
  ClipboardCheck,
  FolderKanban,
  Network,
  ShieldAlert,
} from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { dashboardMetrics, dashboardPriorities, assets, evidenceRecords, mcpTools, projectTasks, projects } from "@/lib/prototype-data"

const metricIcons = {
  项目总数: FolderKanban,
  运行中项目: Activity,
  已发现资产: Network,
  已确认问题: ShieldAlert,
  待审批动作: ClipboardCheck,
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="仪表盘"
        description="优先清理审批阻塞，再处理新增资产与证据复核。"
        actions={
          <>
            <StatusBadge tone="danger">6 个待审批动作</StatusBadge>
            <Button className="rounded-full bg-slate-950 px-5 dark:bg-sky-500 dark:text-slate-950">进入审批中心</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {dashboardMetrics.map((metric) => (
          <StatCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            delta={metric.delta}
            tone={metric.tone}
            icon={metricIcons[metric.label as keyof typeof metricIcons]}
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="今天优先处理" eyebrow="Global Queue" description="按照项目阻塞、审批风险和平台健康度排序。">
          <div className="space-y-4">
            {dashboardPriorities.map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{item.title}</h3>
                  <StatusBadge tone={item.tone}>
                    {item.tone === "danger" ? "P1" : item.tone === "warning" ? "P2" : "P3"}
                  </StatusBadge>
                </div>
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{item.detail}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="MCP 工具健康状态" eyebrow="Control Plane" description="平台所有对外动作都经过能力层。这里先暴露最关键的健康状态。">
          <div className="space-y-3">
            {mcpTools.map((tool) => (
              <div
                key={tool.id}
                className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-900/70"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">{tool.toolName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{tool.capability}</p>
                  </div>
                  <StatusBadge tone={tool.status === "异常" ? "danger" : tool.status === "启用" ? "success" : "warning"}>
                    {tool.status}
                  </StatusBadge>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                  <span>版本 {tool.version}</span>
                  <span>风险 {tool.riskLevel}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard title="运行中项目" eyebrow="Projects" description="聚焦当前关键路径与审批压力。">
          <div className="space-y-3">
            {projects.map((project) => (
              <div key={project.id} className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">{project.name}</p>
                  <StatusBadge tone={project.status === "已阻塞" ? "danger" : "info"}>{project.status}</StatusBadge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{project.stage}</p>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{project.riskSummary}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="最近执行任务" eyebrow="Scheduler" description="让研究员能看懂哪些任务在推进，哪些卡在审批或依赖。">
          <div className="space-y-3">
            {projectTasks.map((task) => (
              <div key={task.id} className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">{task.title}</p>
                  <StatusBadge tone={task.status === "waiting_approval" ? "danger" : task.status === "waiting_dependency" ? "warning" : "info"}>
                    {task.status}
                  </StatusBadge>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">{task.reason}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="最近新发现资产" eyebrow="Asset Feed" description="优先感知新入口、新画像和新证据。">
          <div className="space-y-3">
            {assets.slice(0, 3).map((asset) => (
              <div key={asset.id} className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">{asset.label}</p>
                  <StatusBadge tone={asset.scopeStatus === "待确认" ? "warning" : "success"}>{asset.scopeStatus}</StatusBadge>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">{asset.profile}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{asset.projectName}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="最近验证结果" eyebrow="Evidence" description="首页只显示最值得回看的一小段结果链路。">
        <div className="grid gap-4 md:grid-cols-2">
          {evidenceRecords.map((record) => (
            <div key={record.id} className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{record.title}</h3>
                <StatusBadge tone="warning">{record.conclusion}</StatusBadge>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{record.source}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{record.projectName}</span>
                <span>置信度 {record.confidence}</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
