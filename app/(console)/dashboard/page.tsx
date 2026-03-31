import Link from "next/link"
import {
  ClipboardCheck,
  FolderKanban,
  Network,
  Rocket,
  ShieldAlert,
  Activity,
  ArrowRight,
} from "lucide-react"

import { DashboardAssetPreview } from "@/components/dashboard/dashboard-asset-preview"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { getDashboardPayload } from "@/lib/api-compositions"
import type { Tone } from "@/lib/prototype-types"
import { cn } from "@/lib/utils"

const metricMeta = {
  项目总数: { href: "/projects", icon: FolderKanban },
  已发现资产: { href: "/assets", icon: Network },
  已发现漏洞: { href: "/projects", icon: ShieldAlert },
  待审批动作: { href: "/approvals", icon: ClipboardCheck },
} as const

const toneStyles: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-100",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-200",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-200",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-200",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-200",
}

export default async function DashboardPage() {
  const { metrics, projects, recentResults, systemOverview, assetViews } = await getDashboardPayload()
  const leadProject = projects[0] ?? null
  const isEmptyPlatform = metrics.every((m) => Number(m.value) === 0)

  return (
    <div className="space-y-6">
      <section className="rounded-hero border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 dark:border-slate-800 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              控制台概览
            </p>
            <h1 className="mt-2 text-[32px] font-semibold tracking-tight text-slate-950 dark:text-white">平台仪表盘</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              项目总览、资产、漏洞与审批压力一目了然
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {leadProject ? <StatusBadge tone={leadProject.status === "已阻塞" ? "danger" : "info"}>{leadProject.status}</StatusBadge> : null}
            <Button asChild className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200">
              <Link href="/projects/new">新建项目</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/settings/mcp-tools">MCP 配置</Link>
            </Button>
          </div>
        </div>

        {isEmptyPlatform && (
          <div className="mt-5 rounded-card border border-sky-200/80 bg-sky-50/80 p-6 text-center dark:border-sky-900/60 dark:bg-sky-950/30">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/50">
              <Rocket className="h-6 w-6 text-sky-600 dark:text-sky-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">欢迎使用平台</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              创建第一个项目后，仪表盘会自动展示资产、漏洞和审批信息。
            </p>
            <Link href="/projects/new" className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400">
              创建第一个项目
            </Link>
          </div>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const meta = metricMeta[metric.label as keyof typeof metricMeta]
            const Icon = meta.icon

            return (
              <Link
                key={metric.label}
                href={meta.href}
                className="group rounded-card border border-slate-200/80 bg-slate-50/85 p-5 transition-colors hover:border-slate-300 hover:bg-slate-100/80 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-700 dark:hover:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{metric.label}</p>
                    <p className="mt-3 text-[34px] font-semibold tracking-tight text-slate-950 dark:text-white">{metric.value}</p>
                  </div>
                  <div className={cn("rounded-2xl p-3", toneStyles[metric.tone])}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{metric.delta}</p>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {systemOverview.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="rounded-card border border-slate-200/80 bg-white p-5 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 dark:hover:bg-slate-900/80"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{item.title}</p>
                <p className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950 dark:text-white">{item.value}</p>
              </div>
              <StatusBadge tone={item.tone}>{item.tone === "warning" ? "关注" : item.tone === "success" ? "正常" : "信息"}</StatusBadge>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.detail}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <section className="rounded-hero border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-slate-950 dark:text-white">
            <Activity className="h-4 w-4" />
            最近结果更新
          </div>

          {recentResults.length > 0 ? (
            <div className="mt-5 space-y-3">
              {recentResults.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="block rounded-panel border border-slate-200/80 bg-slate-50/85 p-4 transition-colors hover:border-slate-300 hover:bg-slate-100/80 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{item.title}</p>
                      <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-300">{item.subtitle}</p>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{item.meta}</p>
                    </div>
                    <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-card border border-dashed border-slate-300 bg-slate-50/85 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/60">
              <p className="text-sm font-medium text-slate-950 dark:text-white">当前还没有结果更新时间流</p>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                一旦真实项目开始执行，证据、资产、漏洞与审批动作会按时间顺序回流到这里。
              </p>
            </div>
          )}
        </section>

        <DashboardAssetPreview views={assetViews} />
      </div>
    </div>
  )
}
