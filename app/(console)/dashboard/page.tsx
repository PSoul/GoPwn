import Link from "next/link"
import {
  Activity,
  ArrowRight,
  ClipboardCheck,
  FolderKanban,
  Network,
  ShieldAlert,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { getDashboardPayload } from "@/lib/prototype-api"
import type { Tone } from "@/lib/prototype-types"
import { cn } from "@/lib/utils"

const metricIcons = {
  项目总数: FolderKanban,
  运行中项目: Activity,
  已发现资产: Network,
  已确认问题: ShieldAlert,
  待审批动作: ClipboardCheck,
} satisfies Record<string, LucideIcon>

const toneIconStyles: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-100",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-200",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-200",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-200",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-200",
}

const toneTextStyles: Record<Tone, string> = {
  neutral: "text-slate-700 dark:text-slate-200",
  info: "text-sky-700 dark:text-sky-200",
  success: "text-emerald-700 dark:text-emerald-200",
  warning: "text-amber-700 dark:text-amber-200",
  danger: "text-rose-700 dark:text-rose-200",
}

const quickActions = [
  { href: "/approvals", label: "审批中心" },
  { href: "/projects", label: "项目队列" },
  { href: "/assets", label: "资产中心" },
  { href: "/evidence", label: "证据复核" },
]

type QueueItem = {
  title: string
  subtitle: string
  meta: string
  status: string
  tone: Tone
  icon: LucideIcon
}

type FocusCard = {
  title: string
  subtitle: string
  badge: string
  tone: Tone
  icon: LucideIcon
  progress: number
  progressLabel: string
  amount: string
  amountLabel: string
  note: string
  href: string
  cta: string
}

export default function DashboardPage() {
  const { approvals, assets, evidence, leadProject, mcpTools, metrics, priorities, projectTasks } = getDashboardPayload()
  const approvalMetric = metrics.find((metric) => metric.label === "待审批动作") ?? metrics[0]
  const exceptionTool = mcpTools.find((tool) => tool.status === "异常") ?? mcpTools[0]

  const queueItems: QueueItem[] = [
    {
      title: approvals[0].actionType,
      subtitle: approvals[0].projectName,
      meta: approvals[0].submittedAt,
      status: approvals[0].status,
      tone: "danger",
      icon: ClipboardCheck,
    },
    {
      title: leadProject.name,
      subtitle: leadProject.stage,
      meta: leadProject.lastUpdated,
      status: leadProject.status,
      tone: leadProject.status === "已阻塞" ? "danger" : "info",
      icon: FolderKanban,
    },
    {
      title: projectTasks[0].title,
      subtitle: projectTasks[0].reason,
      meta: projectTasks[0].priority,
      status: "待接管",
      tone: "warning",
      icon: Activity,
    },
    {
      title: assets[2].label,
      subtitle: assets[2].projectName,
      meta: assets[2].lastSeen,
      status: assets[2].scopeStatus,
      tone: "warning",
      icon: Network,
    },
    {
      title: evidence[0].title,
      subtitle: evidence[0].projectName,
      meta: evidence[0].source,
      status: evidence[0].conclusion,
      tone: "warning",
      icon: ShieldAlert,
    },
    {
      title: exceptionTool.toolName,
      subtitle: `${exceptionTool.capability}异常`,
      meta: exceptionTool.lastCheck,
      status: exceptionTool.status,
      tone: "danger",
      icon: ShieldCheck,
    },
  ]

  const focusCards: FocusCard[] = [
    {
      title: priorities[0].title,
      subtitle: priorities[0].detail,
      badge: "进行中",
      tone: "danger",
      icon: ClipboardCheck,
      progress: 68,
      progressLabel: "待审批动作",
      amount: "2 个高风险动作",
      amountLabel: "阻塞主路径",
      note: "目标：恢复受控 PoC 验证",
      href: "/approvals",
      cta: "进入审批中心",
    },
    {
      title: priorities[1].title,
      subtitle: priorities[1].detail,
      badge: "待确认",
      tone: "warning",
      icon: Network,
      progress: 46,
      progressLabel: "新增入口处理",
      amount: "2 个子域待判定",
      amountLabel: "需要回流补采",
      note: "目标：完成范围判定与归属确认",
      href: "/assets",
      cta: "查看资产中心",
    },
    {
      title: "证据链路与平台巡检",
      subtitle: "capture-evidence 健康异常会直接削弱首页结果与审批链路的可信度，需要先恢复采集能力。",
      badge: "巡检中",
      tone: "info",
      icon: ShieldCheck,
      progress: 35,
      progressLabel: "工具健康度",
      amount: "1 个异常工具",
      amountLabel: "影响截图链路",
      note: "目标：恢复证据采集并重新校验",
      href: "/settings",
      cta: "查看系统设置",
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-3xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-950 dark:text-white">
            <FolderKanban className="h-4 w-4" />
            平台控制面
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-5 dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-xs text-slate-500 dark:text-slate-400">当前阻塞动作</p>
              <div className="mt-2 text-[40px] font-semibold tracking-tight text-slate-950 dark:text-white">{approvalMetric.value}</div>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {approvalMetric.delta}，当前以审批清障、入口回流补采和证据链路恢复为第一优先。
              </p>

              <div className="mt-4 space-y-1">
                {metrics.map((metric) => {
                  const Icon = metricIcons[metric.label]

                  return (
                    <div
                      key={metric.label}
                      className="flex items-center justify-between rounded-xl px-3 py-2 transition-colors hover:bg-white/80 dark:hover:bg-slate-950/60"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("rounded-lg p-2", toneIconStyles[metric.tone])}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-900 dark:text-slate-100">{metric.label}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{metric.delta}</p>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{metric.value}</span>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {quickActions.map((action) => (
                  <Button
                    key={action.href}
                    asChild
                    className="h-9 rounded-xl bg-slate-950 text-xs text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200"
                  >
                    <Link href={action.href}>{action.label}</Link>
                  </Button>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">当前主路径</p>
                  <h1 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{leadProject.name}</h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {leadProject.stage} · 最近更新 {leadProject.lastUpdated}
                  </p>
                </div>
                <StatusBadge tone={leadProject.status === "已阻塞" ? "danger" : "info"}>{leadProject.status}</StatusBadge>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{priorities[0].detail}</p>

              <div className="mt-4 space-y-2.5">
                {priorities.map((item, index) => (
                  <div
                    key={item.title}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/80 px-3 py-3 dark:border-slate-800"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-950 dark:text-white">{item.title}</p>
                      <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{item.detail}</p>
                    </div>
                    <StatusBadge tone={item.tone}>{`P${index + 1}`}</StatusBadge>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-200/80 pt-3 dark:border-slate-800">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">下一步</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">先完成审批，再恢复受控验证与证据复核。</p>
                </div>
                <Button asChild variant="ghost" className="rounded-xl px-3 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-950">
                  <Link href={`/projects/${leadProject.id}`}>
                    查看项目
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-950 dark:text-white">
            <Activity className="h-4 w-4" />
            最近处置记录
          </div>

          <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-950 dark:text-white">当前窗口</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">今天</span>
            </div>

            <div className="space-y-1">
              {queueItems.map((item) => (
                <div
                  key={`${item.title}-${item.status}`}
                  className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/70"
                >
                  <div className={cn("rounded-lg border border-slate-200/80 p-2 dark:border-slate-800", toneIconStyles[item.tone])}>
                    <item.icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-950 dark:text-white">{item.title}</p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{item.subtitle}</p>
                  </div>

                  <div className="shrink-0 pl-3 text-right">
                    <p className={cn("text-xs font-medium", toneTextStyles[item.tone])}>{item.status}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{item.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2 border-t border-slate-200/80 pt-2 dark:border-slate-800">
            <Button asChild variant="ghost" className="w-full justify-center rounded-xl text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-950">
              <Link href="/approvals">
                查看审批与结果
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-950 dark:text-white">
          <ClipboardCheck className="h-4 w-4" />
          今天优先处理
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {focusCards.map((card) => (
            <article
              key={card.title}
              className="flex flex-col rounded-[24px] border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className={cn("rounded-lg p-2", toneIconStyles[card.tone])}>
                    <card.icon className="h-4 w-4" />
                  </div>
                  <StatusBadge tone={card.tone}>{card.badge}</StatusBadge>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-950 dark:text-white">{card.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{card.subtitle}</p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">{card.progressLabel}</span>
                    <span className="text-slate-900 dark:text-slate-100">{card.progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-slate-950 dark:bg-slate-100"
                      style={{ width: `${card.progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{card.amount}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{card.amountLabel}</span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">{card.note}</p>
              </div>

              <Link
                href={card.href}
                className="mt-auto flex items-center justify-center gap-2 border-t border-slate-200/80 px-3 py-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900/70 dark:hover:text-white"
              >
                {card.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
