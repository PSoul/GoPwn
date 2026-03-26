"use client"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ApprovalRecord } from "@/lib/prototype-types"
import { cn } from "@/lib/utils"

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

export function ApprovalList({
  records,
  selectedApprovalId,
  onSelectApproval,
}: {
  records: ApprovalRecord[]
  selectedApprovalId?: string
  onSelectApproval: (approvalId: string) => void
}) {
  if (records.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
        当前筛选条件下没有审批记录。
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800">
      <Table>
        <TableHeader className="bg-slate-50/80 dark:bg-slate-900/70">
          <TableRow>
            <TableHead>队列</TableHead>
            <TableHead>审批单</TableHead>
            <TableHead>项目与目标</TableHead>
            <TableHead>动作类型</TableHead>
            <TableHead>风险</TableHead>
            <TableHead>阻塞影响</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((approval) => {
            const isSelected = approval.id === selectedApprovalId

            return (
              <TableRow
                key={approval.id}
                className={cn(
                  "bg-white/90 transition-colors dark:bg-slate-950/70",
                  isSelected && "bg-sky-50/80 dark:bg-sky-950/20",
                )}
              >
                <TableCell className="font-medium text-slate-500 dark:text-slate-400">#{approval.queuePosition}</TableCell>
                <TableCell>
                  <p className="font-medium text-slate-950 dark:text-white">{approval.id}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{approval.submittedAt}</p>
                </TableCell>
                <TableCell>
                  <p className="font-medium text-slate-950 dark:text-white">{approval.projectName}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{approval.target}</p>
                </TableCell>
                <TableCell>
                  <p className="font-medium text-slate-950 dark:text-white">{approval.actionType}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {approval.mcpCapability} · {approval.tool}
                  </p>
                </TableCell>
                <TableCell>
                  <StatusBadge tone={getRiskTone(approval.riskLevel)}>风险 {approval.riskLevel}</StatusBadge>
                </TableCell>
                <TableCell className="max-w-xs text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {approval.blockingImpact}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={getStatusTone(approval.status)}>{approval.status}</StatusBadge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant={isSelected ? "secondary" : "outline"}
                    size="sm"
                    className="rounded-full border-slate-300 dark:border-slate-700"
                    onClick={() => onSelectApproval(approval.id)}
                  >
                    {isSelected ? "已选中" : "查看详情"}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
