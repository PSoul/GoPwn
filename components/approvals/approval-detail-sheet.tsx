"use client"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { ApprovalRecord } from "@/lib/prototype-types"

function getRiskTone(riskLevel: ApprovalRecord["riskLevel"]) {
  if (riskLevel === "高") {
    return "danger" as const
  }

  if (riskLevel === "中") {
    return "warning" as const
  }

  return "success" as const
}

function getStatusTone(status: ApprovalRecord["status"]) {
  if (status === "待处理") {
    return "danger" as const
  }

  if (status === "已延后") {
    return "warning" as const
  }

  if (status === "已批准") {
    return "success" as const
  }

  return "neutral" as const
}

export function ApprovalDetailSheet({
  approval,
  isSubmitting,
  onDecision,
}: {
  approval: ApprovalRecord
  isSubmitting: boolean
  onDecision: (decision: ApprovalRecord["status"]) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={getRiskTone(approval.riskLevel)}>风险 {approval.riskLevel}</StatusBadge>
        <StatusBadge tone={getStatusTone(approval.status)}>{approval.status}</StatusBadge>
        <StatusBadge tone="info">队列 #{approval.queuePosition}</StatusBadge>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
        <p className="text-xs uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">Detail Preview</p>
        <h3 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">{approval.actionType}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {approval.projectName} · {approval.target}
        </p>
      </div>

      <div className="grid gap-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-sm font-semibold text-slate-950 dark:text-white">建议理由</p>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{approval.rationale}</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-sm font-semibold text-slate-950 dark:text-white">阻塞影响</p>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{approval.blockingImpact}</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-sm font-semibold text-slate-950 dark:text-white">工具与参数摘要</p>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {approval.mcpCapability} · {approval.tool}
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{approval.parameterSummary}</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-sm font-semibold text-slate-950 dark:text-white">执行前提与停止条件</p>
          <div className="mt-4 space-y-3">
            {approval.prerequisites.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300"
              >
                {item}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{approval.stopCondition}</p>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">提交时间：{approval.submittedAt}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
        当前状态会被写入本地持久化存储，并同步进入项目活动与平台审计日志。
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          className="rounded-full border-slate-300 dark:border-slate-700"
          onClick={() => onDecision("已延后")}
        >
          {isSubmitting ? "处理中..." : "延后处理"}
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={isSubmitting}
          className="rounded-full bg-rose-600 text-white hover:bg-rose-700"
          onClick={() => onDecision("已拒绝")}
        >
          {isSubmitting ? "处理中..." : "拒绝动作"}
        </Button>
        <Button
          type="button"
          disabled={isSubmitting}
          className="rounded-full bg-slate-950 text-white hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
          onClick={() => onDecision("已批准")}
        >
          {isSubmitting ? "处理中..." : "批准并进入调度"}
        </Button>
      </div>
    </div>
  )
}
