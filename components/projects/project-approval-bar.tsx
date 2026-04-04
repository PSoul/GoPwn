"use client"

import { useState } from "react"
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { Approval, ApprovalStatus, RiskLevel } from "@/lib/generated/prisma"
import { RISK_LEVEL_LABELS } from "@/lib/types/labels"
import { apiFetch } from "@/lib/infra/api-client"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

const riskTone: Record<RiskLevel, Tone> = {
  low: "info",
  medium: "warning",
  high: "danger",
}

export function ProjectApprovalBar({
  initialApprovals,
}: {
  initialApprovals: Approval[]
}) {
  const [approvals, setApprovals] = useState(initialApprovals)
  const [expanded, setExpanded] = useState(false)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  const pending = approvals.filter((a) => a.status === "pending")

  async function handleDecision(approvalId: string, status: ApprovalStatus) {
    setProcessingIds((prev) => new Set(prev).add(approvalId))
    try {
      const payload = await apiFetch<{ approval: Approval }>(`/api/approvals/${approvalId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
      if (payload.approval) {
        setApprovals((prev) =>
          prev.map((a) => (a.id === approvalId ? payload.approval : a)),
        )
      }
    } catch { /* best-effort */ } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(approvalId)
        return next
      })
    }
  }

  async function handleApproveAll() {
    await Promise.allSettled(
      pending.map((a) => handleDecision(a.id, "approved")),
    )
  }

  if (pending.length === 0) return null

  return (
    <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-3"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
            有 {pending.length} 个高风险操作待审批
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-amber-200/60 px-5 pb-4 pt-3 dark:border-amber-900/40">
          <div className="mb-3 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full text-xs"
              onClick={handleApproveAll}
            >
              全部批准
            </Button>
          </div>

          <div className="space-y-3">
            {pending.map((approval) => (
              <div
                key={approval.id}
                className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={riskTone[approval.riskLevel]}>
                        {RISK_LEVEL_LABELS[approval.riskLevel]}
                      </StatusBadge>
                      <span className="text-sm font-medium text-slate-950 dark:text-white">
                        {approval.actionType}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      目标: {approval.target}
                    </p>
                    {approval.rationale && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {approval.rationale}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-full px-3 text-xs text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                      disabled={processingIds.has(approval.id)}
                      onClick={() => handleDecision(approval.id, "approved")}
                    >
                      批准
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-full px-3 text-xs text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                      disabled={processingIds.has(approval.id)}
                      onClick={() => handleDecision(approval.id, "rejected")}
                    >
                      拒绝
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-full px-3 text-xs"
                      disabled={processingIds.has(approval.id)}
                      onClick={() => handleDecision(approval.id, "deferred")}
                    >
                      延后
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
