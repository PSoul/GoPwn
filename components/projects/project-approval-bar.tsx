"use client"

import { useState } from "react"
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { ApprovalRecord } from "@/lib/prototype-types"
import { apiFetch } from "@/lib/infra/api-client"

const riskTone = {
  高: "danger",
  中: "warning",
  低: "info",
} as const

type Decision = "已批准" | "已拒绝" | "已延后"

export function ProjectApprovalBar({
  projectId,
  initialApprovals,
}: {
  projectId: string
  initialApprovals: ApprovalRecord[]
}) {
  const [approvals, setApprovals] = useState(initialApprovals)
  const [expanded, setExpanded] = useState(false)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  const pending = approvals.filter((a) => a.status === "待处理")

  async function handleDecision(approvalId: string, decision: Decision) {
    setProcessingIds((prev) => new Set(prev).add(approvalId))
    try {
      const res = await apiFetch(`/api/approvals/${approvalId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      if (res.ok) {
        setApprovals((prev) =>
          prev.map((a) => (a.id === approvalId ? { ...a, status: decision } : a)),
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
      pending.map((a) => handleDecision(a.id, "已批准")),
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
                        {approval.riskLevel}风险
                      </StatusBadge>
                      <span className="text-sm font-medium text-slate-950 dark:text-white">
                        {approval.actionType}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      目标: {approval.target}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {approval.rationale}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-full px-3 text-xs text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                      disabled={processingIds.has(approval.id)}
                      onClick={() => handleDecision(approval.id, "已批准")}
                    >
                      批准
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-full px-3 text-xs text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                      disabled={processingIds.has(approval.id)}
                      onClick={() => handleDecision(approval.id, "已拒绝")}
                    >
                      拒绝
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-full px-3 text-xs"
                      disabled={processingIds.has(approval.id)}
                      onClick={() => handleDecision(approval.id, "已延后")}
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
