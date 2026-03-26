import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { McpToolRecord } from "@/lib/prototype-types"

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

export function McpToolTable({ tools }: { tools: McpToolRecord[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800">
      <Table>
        <TableHeader className="bg-slate-50/80 dark:bg-slate-900/70">
          <TableRow>
            <TableHead>工具</TableHead>
            <TableHead>能力分类</TableHead>
            <TableHead>风险级别</TableHead>
            <TableHead>并发 / 速率</TableHead>
            <TableHead>超时 / 重试</TableHead>
            <TableHead>最近巡检</TableHead>
            <TableHead>状态</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tools.map((tool) => (
            <TableRow key={tool.id} className="bg-white/90 dark:bg-slate-950/70">
              <TableCell>
                <p className="font-medium text-slate-950 dark:text-white">{tool.toolName}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">v{tool.version}</p>
              </TableCell>
              <TableCell>
                <p>{tool.capability}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tool.category}</p>
              </TableCell>
              <TableCell>
                <StatusBadge tone={getRiskTone(tool.riskLevel)}>风险 {tool.riskLevel}</StatusBadge>
              </TableCell>
              <TableCell>
                <p>{tool.defaultConcurrency}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tool.rateLimit}</p>
              </TableCell>
              <TableCell>
                <p>{tool.timeout}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tool.retry}</p>
              </TableCell>
              <TableCell>{tool.lastCheck}</TableCell>
              <TableCell>
                <StatusBadge tone={getStatusTone(tool.status)}>{tool.status}</StatusBadge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
