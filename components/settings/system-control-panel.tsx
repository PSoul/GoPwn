import { AlertTriangle, Ban, Gauge, ShieldCheck } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { ControlSetting, PolicyRecord } from "@/lib/prototype-types"

const overviewIcons = [Gauge, ShieldCheck, Gauge, AlertTriangle]

export function SystemControlPanel({
  overview,
  approvalPolicies,
  scopeRules,
}: {
  overview: ControlSetting[]
  approvalPolicies: PolicyRecord[]
  scopeRules: PolicyRecord[]
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {overview.map((item, index) => {
          const Icon = overviewIcons[index]

          return (
            <div
              key={item.label}
              className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{item.value}</p>
                </div>
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
            </div>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-950 dark:text-white">审批策略</h3>
              <StatusBadge tone="danger">高风险受控动作</StatusBadge>
            </div>
            <div className="space-y-3">
              {approvalPolicies.map((policy) => (
                <div
                  key={policy.title}
                  className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">{policy.title}</p>
                    <StatusBadge tone={policy.status === "已触发" ? "danger" : "info"}>{policy.status}</StatusBadge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{policy.description}</p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">责任方：{policy.owner}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">范围规则</h3>
            <div className="mt-4 space-y-3">
              {scopeRules.map((rule) => (
                <div
                  key={rule.title}
                  className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">{rule.title}</p>
                    <StatusBadge tone="info">{rule.status}</StatusBadge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{rule.description}</p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">责任方：{rule.owner}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-rose-200/80 bg-[linear-gradient(180deg,_rgba(255,241,242,0.95),_rgba(255,255,255,0.92))] p-6 dark:border-rose-900/60 dark:bg-[linear-gradient(180deg,_rgba(76,5,25,0.38),_rgba(2,6,23,0.92))]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-rose-100 p-3 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200">
              <Ban className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-rose-600 dark:text-rose-300">Emergency Stop</p>
              <h3 className="text-xl font-semibold text-slate-950 dark:text-white">紧急停止</h3>
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-700 dark:text-slate-200">
            当 MCP 工具健康异常、目标环境波动明显或授权语境发生变化时，研究员需要能一键切断高风险动作调度。
          </p>
          <div className="mt-6 space-y-3">
            {[
              "暂停所有高风险受控验证任务",
              "仅保留被动收集与归属判断能力",
              "要求恢复前完成工具巡检与人工复核",
            ].map((item) => (
              <div
                key={item}
                className="rounded-3xl border border-rose-200/80 bg-white/80 p-4 text-sm leading-6 text-slate-700 dark:border-rose-900/60 dark:bg-slate-950/50 dark:text-slate-200"
              >
                {item}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button variant="destructive" className="rounded-full bg-rose-600 text-white hover:bg-rose-700">
              立即停止高风险动作
            </Button>
            <Button variant="outline" className="rounded-full border-rose-300 bg-white/80 dark:border-rose-800 dark:bg-slate-950/50">
              进入巡检模式
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
