"use client"

import { useState } from "react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import type { ApprovalControl, ApprovalRecord, ProjectDetailRecord, ProjectRecord } from "@/lib/prototype-types"
import { apiFetch } from "@/lib/infra/api-client"

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

  async function saveControl(nextControl: ApprovalControl) {
    setIsSaving(true)
    setMessage(null)
    try {
      const response = await apiFetch(`/api/projects/${project.id}/approval-control`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: nextControl.enabled,
          autoApproveLowRisk: nextControl.autoApproveLowRisk,
          note: nextControl.note,
        }),
      })
      const payload = await response.json()
      if (response.ok && payload.detail) {
        setControl(payload.detail.approvalControl)
        setMessage("审批策略已更新")
      }
    } catch { /* best-effort */ } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-sm font-medium text-slate-950 dark:text-white">审批与项目状态</p>

      {/* Approval controls — compact */}
      <div className="mt-4 space-y-3">
        <label className="flex cursor-pointer items-center justify-between">
          <div>
            <span className="text-sm text-slate-700 dark:text-slate-200">高风险动作需审批</span>
            <p className="text-xs text-slate-500 dark:text-slate-400">{control.description}</p>
          </div>
          <Switch
            checked={control.enabled}
            onCheckedChange={(checked) => setControl((c) => ({ ...c, enabled: checked }))}
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between">
          <span className="text-sm text-slate-700 dark:text-slate-200">低风险自动放行</span>
          <Switch
            checked={control.autoApproveLowRisk}
            onCheckedChange={(checked) => setControl((c) => ({ ...c, autoApproveLowRisk: checked }))}
          />
        </label>
        <div className="flex items-center gap-2">
          <Button size="sm" className="rounded-full" disabled={isSaving} onClick={() => saveControl(control)}>
            {isSaving ? "保存中..." : "保存"}
          </Button>
          {message && <span className="text-xs text-emerald-600 dark:text-emerald-400">{message}</span>}
        </div>
      </div>

      {/* Closure status — one line */}
      <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-700 dark:text-slate-200">自动收尾状态</p>
          <StatusBadge tone={detail.closureStatus.tone}>{detail.closureStatus.label}</StatusBadge>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail.closureStatus.summary}</p>
        <div className="mt-2 flex gap-2">
          <StatusBadge tone={detail.closureStatus.reportExported ? "success" : "neutral"}>
            报告{detail.closureStatus.reportExported ? "已导出" : "待导出"}
          </StatusBadge>
          <StatusBadge tone={detail.closureStatus.finalConclusionGenerated ? "success" : "neutral"}>
            结论{detail.closureStatus.finalConclusionGenerated ? "已生成" : "待生成"}
          </StatusBadge>
        </div>
      </div>

      {/* Approvals list — compact */}
      {approvals.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">审批记录 ({approvals.length})</p>
          <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {approvals.slice(0, 5).map((approval) => (
              <div key={approval.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-900 dark:text-white">{approval.actionType}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{approval.target}</p>
                </div>
                <StatusBadge tone={approvalTone[approval.status]}>{approval.status}</StatusBadge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mt-4 flex gap-4 border-t border-slate-100 pt-4 text-center dark:border-slate-800">
        <div>
          <p className="text-2xl font-semibold text-slate-950 dark:text-white">{project.pendingApprovals}</p>
          <p className="text-xs text-slate-500">待审批</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-slate-950 dark:text-white">{project.openTasks}</p>
          <p className="text-xs text-slate-500">开放任务</p>
        </div>
      </div>
    </div>
  )
}
