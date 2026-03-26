import { Search } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

export function ApprovalList({ records }: { records: ApprovalRecord[] }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="搜索审批单号、项目、目标或工具..."
            className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10 dark:border-slate-800 dark:bg-slate-900"
          />
        </div>
        <Input
          value="状态筛选：待处理 / 已延后"
          readOnly
          className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
        />
        <Input
          value="风险筛选：高 / 中"
          readOnly
          className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
        />
      </div>

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
            {records.map((approval) => (
              <TableRow key={approval.id} className="bg-white/90 dark:bg-slate-950/70">
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
                  <Button variant="outline" size="sm" className="rounded-full border-slate-300 dark:border-slate-700">
                    查看详情
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
