"use client"

import { useState } from "react"
import { AlertTriangle, Ban, Gauge, ShieldCheck } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch } from "@/lib/infra/api-client"
import type { ApprovalControl, ControlSetting, PolicyRecord } from "@/lib/prototype-types"

const overviewIcons = [Gauge, ShieldCheck, Gauge, AlertTriangle]

export function SystemControlPanel({
  overview,
  approvalControl,
  approvalPolicies,
  scopeRules,
}: {
  overview: ControlSetting[]
  approvalControl: ApprovalControl
  approvalPolicies: PolicyRecord[]
  scopeRules: PolicyRecord[]
}) {
  const [control, setControl] = useState(approvalControl)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function saveControl(patch: Partial<ApprovalControl> & { note?: string }) {
    setIsSaving(true)
    setMessage(null)
    setErrorMessage(null)

    try {
      const response = await apiFetch("/api/settings/approval-policy", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(patch),
      })
      const payload = (await response.json()) as { approvalControl?: ApprovalControl; error?: string }

      if (!response.ok || !payload.approvalControl) {
        setErrorMessage(payload.error ?? "全局审批策略保存失败，请稍后再试。")
        return
      }

      setControl(payload.approvalControl)
      setMessage(`全局审批策略已更新：${payload.approvalControl.mode}`)
    } catch {
      setErrorMessage("全局审批策略保存失败，请稍后再试。")
    } finally {
      setIsSaving(false)
    }
  }

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

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white">审批模式开关</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{control.description}</p>
              </div>
              <Switch
                checked={control.enabled}
                aria-label="全局审批模式开关"
                onCheckedChange={(checked) => setControl((current) => ({ ...current, enabled: checked }))}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge tone={control.enabled ? "warning" : "neutral"}>{control.mode}</StatusBadge>
              <StatusBadge tone={control.autoApproveLowRisk ? "success" : "warning"}>
                低风险自动放行：{control.autoApproveLowRisk ? "开启" : "关闭"}
              </StatusBadge>
            </div>
            <div className="mt-5 flex items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
              <div>
                <p className="text-sm font-medium text-slate-950 dark:text-white">低风险自动放行</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">关闭后，低风险动作也会回到人工确认。</p>
              </div>
              <Switch
                checked={control.autoApproveLowRisk}
                aria-label="低风险自动放行"
                onCheckedChange={(checked) => setControl((current) => ({ ...current, autoApproveLowRisk: checked }))}
              />
            </div>
            <div className="mt-5 space-y-3">
              <p className="text-sm font-medium text-slate-950 dark:text-white">策略备注</p>
              <Textarea
                aria-label="全局策略备注"
                value={control.note}
                onChange={(event) => setControl((current) => ({ ...current, note: event.target.value }))}
                className="min-h-28 rounded-3xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
              />
            </div>

            {message ? (
              <div className="mt-4 rounded-3xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                {message}
              </div>
            ) : null}

            {errorMessage ? (
              <div className="mt-4 rounded-3xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
                {errorMessage}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                disabled={isSaving}
                className="rounded-full bg-slate-950 text-white hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                onClick={() =>
                  saveControl({
                    enabled: control.enabled,
                    autoApproveLowRisk: control.autoApproveLowRisk,
                    note: control.note,
                  })
                }
              >
                {isSaving ? "保存中..." : "保存全局策略"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                className="rounded-full"
                onClick={() =>
                  saveControl({
                    enabled: true,
                    autoApproveLowRisk: false,
                    note: "进入巡检模式：仅允许人工复核后的动作继续推进，暂停低风险自动放行。",
                  })
                }
              >
                进入巡检模式
              </Button>
            </div>
          </div>

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
            当探测工具健康异常、目标环境波动明显或授权语境发生变化时，研究员需要能一键切断高风险动作调度，但不必影响正常的工作日志和被动结果采集。
          </p>
          <div className="mt-6 space-y-3">
            {[
              "暂停所有高风险受控验证任务",
              "仅保留被动收集、资产归属和证据刷新",
              "恢复前要求完成工具巡检与人工复核",
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
            <Button
              type="button"
              variant="destructive"
              disabled={isSaving}
              className="rounded-full bg-rose-600 text-white hover:bg-rose-700"
              onClick={() =>
                saveControl({
                  enabled: true,
                  autoApproveLowRisk: false,
                  note: "紧急停止已触发：暂停所有高风险受控动作，仅保留被动采集、资产归属和证据刷新。",
                })
              }
            >
              立即停止高风险动作
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              className="rounded-full border-rose-300 bg-white/80 dark:border-rose-800 dark:bg-slate-950/50"
              onClick={() =>
                saveControl({
                  enabled: true,
                  autoApproveLowRisk: true,
                  note: "审批策略已恢复默认：高风险动作继续审批，低风险动作恢复自动放行。",
                })
              }
            >
              恢复默认策略
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
