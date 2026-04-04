"use client"

import { useState } from "react"
import { Ban } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { apiFetch } from "@/lib/infra/api-client"
import type { GlobalConfig } from "@/lib/generated/prisma"

export function SystemControlPanel({
  initialConfig,
}: {
  initialConfig: GlobalConfig
}) {
  const [config, setConfig] = useState(initialConfig)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function saveControl(patch: Partial<GlobalConfig>) {
    setIsSaving(true)
    setMessage(null)
    setErrorMessage(null)

    try {
      const payload = await apiFetch<{ config: GlobalConfig }>("/api/settings/approval-policy", {
        method: "PATCH",
        body: JSON.stringify(patch),
      })

      if (payload.config) {
        setConfig(payload.config)
        setMessage("全局审批策略已更新。")
      }
    } catch {
      setErrorMessage("全局审批策略保存失败，请稍后再试。")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white">审批模式开关</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  开启后高风险操作需人工审批。
                </p>
              </div>
              <Switch
                checked={config.approvalEnabled}
                aria-label="全局审批模式开关"
                onCheckedChange={(checked) => setConfig((c) => ({ ...c, approvalEnabled: checked }))}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge tone={config.approvalEnabled ? "warning" : "neutral"}>
                {config.approvalEnabled ? "审批已开启" : "审批已关闭"}
              </StatusBadge>
              <StatusBadge tone={config.autoApproveLowRisk ? "success" : "warning"}>
                低风险自动放行：{config.autoApproveLowRisk ? "开启" : "关闭"}
              </StatusBadge>
              <StatusBadge tone={config.autoApproveMediumRisk ? "success" : "warning"}>
                中风险自动放行：{config.autoApproveMediumRisk ? "开启" : "关闭"}
              </StatusBadge>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
                <div>
                  <p className="text-sm font-medium text-slate-950 dark:text-white">低风险自动放行</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">关闭后，低风险动作也会回到人工确认。</p>
                </div>
                <Switch
                  checked={config.autoApproveLowRisk}
                  aria-label="低风险自动放行"
                  onCheckedChange={(checked) => setConfig((c) => ({ ...c, autoApproveLowRisk: checked }))}
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
                <div>
                  <p className="text-sm font-medium text-slate-950 dark:text-white">中风险自动放行</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">关闭后，中风险动作也会回到人工确认。</p>
                </div>
                <Switch
                  checked={config.autoApproveMediumRisk}
                  aria-label="中风险自动放行"
                  onCheckedChange={(checked) => setConfig((c) => ({ ...c, autoApproveMediumRisk: checked }))}
                />
              </div>
            </div>

            {message && (
              <div className="mt-4 rounded-3xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                {message}
              </div>
            )}

            {errorMessage && (
              <div className="mt-4 rounded-3xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
                {errorMessage}
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                disabled={isSaving}
                className="rounded-full"
                onClick={() =>
                  saveControl({
                    approvalEnabled: config.approvalEnabled,
                    autoApproveLowRisk: config.autoApproveLowRisk,
                    autoApproveMediumRisk: config.autoApproveMediumRisk,
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
                    approvalEnabled: true,
                    autoApproveLowRisk: false,
                    autoApproveMediumRisk: false,
                  })
                }
              >
                进入巡检模式
              </Button>
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
            当探测工具健康异常、目标环境波动明显或授权语境发生变化时，研究员需要能一键切断高风险动作调度。
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
                  approvalEnabled: true,
                  autoApproveLowRisk: false,
                  autoApproveMediumRisk: false,
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
                  approvalEnabled: true,
                  autoApproveLowRisk: true,
                  autoApproveMediumRisk: false,
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
