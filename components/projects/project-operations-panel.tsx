"use client"

import { useState } from "react"
import { ShieldCheck, TimerReset } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { ApprovalControl, ApprovalRecord, ProjectDetailRecord, ProjectRecord } from "@/lib/prototype-types"

const approvalTone = {
  待处理: "danger",
  已批准: "success",
  已拒绝: "neutral",
  已延后: "warning",
} as const

export function ProjectOperationsPanel({
  project,
  detail,
  approvals,
}: {
  project: ProjectRecord
  detail: ProjectDetailRecord
  approvals: ApprovalRecord[]
}) {
  const [control, setControl] = useState(detail.approvalControl)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function saveControl(nextControl: ApprovalControl) {
    setIsSaving(true)
    setMessage(null)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/projects/${project.id}/approval-control`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          enabled: nextControl.enabled,
          autoApproveLowRisk: nextControl.autoApproveLowRisk,
          note: nextControl.note,
        }),
      })
      const payload = (await response.json()) as {
        detail?: ProjectDetailRecord
        error?: string
        project?: ProjectRecord
      }

      if (!response.ok || !payload.detail) {
        setErrorMessage(payload.error ?? "项目审批策略保存失败，请稍后再试。")
        return
      }

      setControl(payload.detail.approvalControl)
      setMessage(`项目审批策略已更新：${payload.detail.approvalControl.mode}`)
    } catch {
      setErrorMessage("项目审批策略保存失败，请稍后再试。")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <SectionCard
        title="审批模式开关"
        description="审批主要是控制某些 MCP 调用是否需要人工确认，不应该喧宾夺主，但必须在二级页里明确可见。"
      >
        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950 dark:text-white">项目审批开关</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{control.description}</p>
              </div>
              <Switch
                checked={control.enabled}
                aria-label="项目审批开关"
                onCheckedChange={(checked) => setControl((current) => ({ ...current, enabled: checked }))}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge tone={control.enabled ? "warning" : "neutral"}>{control.mode}</StatusBadge>
              <StatusBadge tone={control.autoApproveLowRisk ? "success" : "warning"}>
                低风险自动放行：{control.autoApproveLowRisk ? "开启" : "关闭"}
              </StatusBadge>
            </div>
            <div className="mt-5 flex items-center justify-between gap-4 rounded-[20px] border border-slate-200/80 bg-white/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
              <div>
                <p className="text-sm font-medium text-slate-950 dark:text-white">低风险自动放行</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">关闭后，低风险补采和识别也会回到人工确认。</p>
              </div>
              <Switch
                checked={control.autoApproveLowRisk}
                aria-label="项目低风险自动放行"
                onCheckedChange={(checked) => setControl((current) => ({ ...current, autoApproveLowRisk: checked }))}
              />
            </div>
            <div className="mt-5 space-y-3">
              <p className="text-sm font-medium text-slate-950 dark:text-white">项目备注</p>
              <Textarea
                aria-label="项目策略备注"
                value={control.note}
                onChange={(event) => setControl((current) => ({ ...current, note: event.target.value }))}
                className="min-h-24 rounded-[24px] border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-950/70"
              />
            </div>

            {message ? (
              <div className="mt-4 rounded-[20px] border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                {message}
              </div>
            ) : null}

            {errorMessage ? (
              <div className="mt-4 rounded-[20px] border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
                {errorMessage}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                disabled={isSaving}
                className="rounded-full bg-slate-950 text-white hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                onClick={() => saveControl(control)}
              >
                {isSaving ? "保存中..." : "保存项目策略"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                className="rounded-full"
                onClick={() =>
                  saveControl({
                    ...control,
                    enabled: true,
                    autoApproveLowRisk: true,
                    note: "项目恢复为高风险审批、低风险自动放行，适合继续结果面补采与证据刷新。",
                  })
                }
              >
                恢复建议配置
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <ShieldCheck className="h-4 w-4" />
                <p className="text-sm font-semibold">审批负载</p>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{project.pendingApprovals}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">当前待处理审批动作数量，只有高风险动作会在这里形成阻塞。</p>
            </div>
            <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <TimerReset className="h-4 w-4" />
                <p className="text-sm font-semibold">开放任务</p>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{project.openTasks}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">任务与调度从主页面下沉后，统一在这里处理人工接管、等待依赖和恢复调度。</p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="项目审批记录" description="只保留和当前项目相关的审批，帮助研究员判断哪些动作需要继续人工放行。">
        <div className="space-y-3">
          {approvals.map((approval) => (
            <div
              key={approval.id}
              className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">{approval.actionType}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{approval.rationale}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge tone={approvalTone[approval.status]}>{approval.status}</StatusBadge>
                  <StatusBadge tone={approval.riskLevel === "高" ? "danger" : approval.riskLevel === "中" ? "warning" : "success"}>
                    风险 {approval.riskLevel}
                  </StatusBadge>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[20px] border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-xs text-slate-500 dark:text-slate-400">目标</p>
                  <p className="mt-1 text-sm font-medium text-slate-950 dark:text-white">{approval.target}</p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{approval.submittedAt}</p>
                </div>
                <div className="rounded-[20px] border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-xs text-slate-500 dark:text-slate-400">MCP / 参数摘要</p>
                  <p className="mt-1 text-sm font-medium text-slate-950 dark:text-white">
                    {approval.tool} · {approval.mcpCapability}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{approval.parameterSummary}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
