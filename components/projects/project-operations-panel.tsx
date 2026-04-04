"use client"

import { useState } from "react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import type { Project, Approval, GlobalConfig, ApprovalStatus, RiskLevel } from "@/lib/generated/prisma"
import { APPROVAL_STATUS_LABELS, RISK_LEVEL_LABELS, LIFECYCLE_LABELS } from "@/lib/types/labels"
import { apiFetch } from "@/lib/infra/api-client"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

const approvalTone: Record<ApprovalStatus, Tone> = {
  pending: "danger",
  approved: "success",
  rejected: "neutral",
  deferred: "warning",
}

const riskTone: Record<RiskLevel, Tone> = {
  low: "info",
  medium: "warning",
  high: "danger",
}

export function ProjectOperationsPanel({
  project,
  approvals,
  globalConfig,
}: {
  project: Project
  approvals: Approval[]
  globalConfig?: GlobalConfig
}) {
  const [config, setConfig] = useState({
    approvalEnabled: globalConfig?.approvalEnabled ?? true,
    autoApproveLowRisk: globalConfig?.autoApproveLowRisk ?? false,
    autoApproveMediumRisk: globalConfig?.autoApproveMediumRisk ?? false,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function saveControl() {
    setIsSaving(true)
    setMessage(null)
    try {
      await apiFetch(`/api/projects/${project.id}/approval-control`, {
        method: "PATCH",
        body: JSON.stringify(config),
      })
      setMessage("审批策略已更新")
    } catch { /* best-effort */ } finally {
      setIsSaving(false)
    }
  }

  const pendingCount = approvals.filter((a) => a.status === "pending").length

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-sm font-medium text-slate-950 dark:text-white">审批与项目状态</p>

      {/* Lifecycle status */}
      <div className="mt-4 flex items-center gap-3">
        <StatusBadge tone="info">{LIFECYCLE_LABELS[project.lifecycle]}</StatusBadge>
        <span className="text-xs text-slate-500">R{project.currentRound}/{project.maxRounds}</span>
      </div>

      {/* Approval controls */}
      <div className="mt-4 space-y-3">
        <label className="flex cursor-pointer items-center justify-between">
          <div>
            <span className="text-sm text-slate-700 dark:text-slate-200">高风险动作需审批</span>
            <p className="text-xs text-slate-500 dark:text-slate-400">开启后高风险操作需人工审批。</p>
          </div>
          <Switch
            checked={config.approvalEnabled}
            onCheckedChange={(checked) => setConfig((c) => ({ ...c, approvalEnabled: checked }))}
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between">
          <span className="text-sm text-slate-700 dark:text-slate-200">低风险自动放行</span>
          <Switch
            checked={config.autoApproveLowRisk}
            onCheckedChange={(checked) => setConfig((c) => ({ ...c, autoApproveLowRisk: checked }))}
          />
        </label>
        <div className="flex items-center gap-2">
          <Button size="sm" className="rounded-full" disabled={isSaving} onClick={saveControl}>
            {isSaving ? "保存中..." : "保存"}
          </Button>
          {message && <span className="text-xs text-emerald-600 dark:text-emerald-400">{message}</span>}
        </div>
      </div>

      {/* Approvals list */}
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
                <div className="flex gap-1">
                  <StatusBadge tone={approvalTone[approval.status]}>{APPROVAL_STATUS_LABELS[approval.status]}</StatusBadge>
                  <StatusBadge tone={riskTone[approval.riskLevel]}>{RISK_LEVEL_LABELS[approval.riskLevel]}</StatusBadge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mt-4 flex gap-4 border-t border-slate-100 pt-4 text-center dark:border-slate-800">
        <div>
          <p className="text-2xl font-semibold text-slate-950 dark:text-white">{pendingCount}</p>
          <p className="text-xs text-slate-500">待审批</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-slate-950 dark:text-white">{approvals.length}</p>
          <p className="text-xs text-slate-500">总审批</p>
        </div>
      </div>
    </div>
  )
}
