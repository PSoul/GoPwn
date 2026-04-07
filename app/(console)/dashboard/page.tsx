import Link from "next/link"
import {
  FolderKanban,
  Network,
  ShieldAlert,
  Activity,
  Rocket,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { getDashboardData } from "@/lib/services/dashboard-service"
import { LIFECYCLE_LABELS } from "@/lib/types/labels"

export default async function DashboardPage() {
  const data = await getDashboardData()

  const metrics = [
    { label: "项目总数", value: data.projectCount, icon: FolderKanban, href: "/projects" },
    { label: "活跃项目", value: data.activeCount, icon: Activity, href: "/projects" },
    { label: "资产发现", value: data.recentProjects.reduce((s, p) => s + (p._count?.assets ?? 0), 0), icon: Network, href: "/assets" },
    { label: "漏洞发现", value: data.findingStats.reduce((s, f) => s + f._count, 0), icon: ShieldAlert, href: "/vuln-center" },
  ]

  const isEmpty = data.projectCount === 0

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
            <Button asChild className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200">
              <Link href="/projects/new">新建项目</Link>
            </Button>
          </div>
        </div>

        {isEmpty && (
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
          {metrics.map((m) => (
            <Link
              key={m.label}
              href={m.href}
              className="group rounded-card border border-slate-200/80 bg-slate-50/85 p-5 transition-colors hover:border-slate-300 hover:bg-slate-100/80 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-700 dark:hover:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{m.label}</p>
                  <p className="mt-3 text-[34px] font-semibold tracking-tight text-slate-950 dark:text-white">{m.value}</p>
                </div>
                <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-900">
                  <m.icon className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {data.recentProjects.length > 0 && (
        <section className="rounded-hero border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-slate-950 dark:text-white">
            <Activity className="h-4 w-4" />
            最近项目
          </div>
          <div className="mt-5 space-y-3">
            {data.recentProjects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="block rounded-panel border border-slate-200/80 bg-slate-50/85 p-4 transition-colors hover:border-slate-300 hover:bg-slate-100/80 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-700 dark:hover:bg-slate-900"
              >
                <p className="text-sm font-semibold text-slate-950 dark:text-white">{p.name}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {LIFECYCLE_LABELS[p.lifecycle]} · {p.targets.length} 个目标
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
