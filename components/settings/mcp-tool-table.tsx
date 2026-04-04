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
import type { McpTool, RiskLevel } from "@/lib/generated/prisma"
import { RISK_LEVEL_LABELS } from "@/lib/types/labels"
import { cn } from "@/lib/utils"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

const riskTone: Record<RiskLevel, Tone> = {
  low: "info",
  medium: "warning",
  high: "danger",
}

export function McpToolTable({
  tools,
  selectedToolId,
  onSelectTool,
}: {
  tools: McpTool[]
  selectedToolId?: string
  onSelectTool: (toolId: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200/80 dark:border-slate-800">
      <Table>
        <TableHeader className="bg-slate-50/80 dark:bg-slate-900/70">
          <TableRow>
            <TableHead>工具</TableHead>
            <TableHead>能力分类</TableHead>
            <TableHead>边界 / 审批</TableHead>
            <TableHead>风险级别</TableHead>
            <TableHead>超时</TableHead>
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
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tool.serverName}</p>
                </TableCell>
                <TableCell>
                  <p>{tool.capability}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-slate-700 dark:text-slate-200">{tool.boundary}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {tool.requiresApproval ? "需要审批" : "自动执行"}
                  </p>
                </TableCell>
                <TableCell>
                  <StatusBadge tone={riskTone[tool.riskLevel]}>{RISK_LEVEL_LABELS[tool.riskLevel]}</StatusBadge>
                </TableCell>
                <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                  {tool.timeout}ms
                </TableCell>
                <TableCell>
                  <StatusBadge tone={tool.enabled ? "success" : "neutral"}>
                    {tool.enabled ? "已启用" : "已停用"}
                  </StatusBadge>
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
