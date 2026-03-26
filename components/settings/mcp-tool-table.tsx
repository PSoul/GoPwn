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
import type { McpToolRecord } from "@/lib/prototype-types"
import { cn } from "@/lib/utils"

function getRiskTone(riskLevel: McpToolRecord["riskLevel"]) {
  if (riskLevel === "高") {
    return "danger" as const
  }

  if (riskLevel === "中") {
    return "warning" as const
  }

  return "success" as const
}

function getStatusTone(status: McpToolRecord["status"]) {
  if (status === "异常") {
    return "danger" as const
  }

  if (status === "启用") {
    return "success" as const
  }

  return "neutral" as const
}

export function McpToolTable({
  tools,
  selectedToolId,
  onSelectTool,
}: {
  tools: McpToolRecord[]
  selectedToolId?: string
  onSelectTool: (toolId: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800">
      <Table>
        <TableHeader className="bg-slate-50/80 dark:bg-slate-900/70">
          <TableRow>
            <TableHead>工具</TableHead>
            <TableHead>能力分类</TableHead>
            <TableHead>边界 / 审批</TableHead>
            <TableHead>风险级别</TableHead>
            <TableHead>并发 / 速率</TableHead>
            <TableHead>最近巡检</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tools.map((tool) => {
            const isSelected = tool.id === selectedToolId

            return (
              <TableRow
                key={tool.id}
                className={cn(
                  "bg-white/90 transition-colors dark:bg-slate-950/70",
                  isSelected && "bg-sky-50/80 dark:bg-sky-950/20",
                )}
              >
                <TableCell>
                  <p className="font-medium text-slate-950 dark:text-white">{tool.toolName}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">v{tool.version}</p>
                </TableCell>
                <TableCell>
                  <p>{tool.capability}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tool.category}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-slate-700 dark:text-slate-200">{tool.boundary}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {tool.requiresApproval ? "默认需要审批" : "默认自动执行"}
                  </p>
                </TableCell>
                <TableCell>
                  <StatusBadge tone={getRiskTone(tool.riskLevel)}>风险 {tool.riskLevel}</StatusBadge>
                </TableCell>
                <TableCell>
                  <p>{tool.defaultConcurrency}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tool.rateLimit}</p>
                </TableCell>
                <TableCell>{tool.lastCheck}</TableCell>
                <TableCell>
                  <StatusBadge tone={getStatusTone(tool.status)}>{tool.status}</StatusBadge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant={isSelected ? "secondary" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => onSelectTool(tool.id)}
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
