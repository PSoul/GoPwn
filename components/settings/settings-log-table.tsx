import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { LogRecord } from "@/lib/prototype-types"

function getStatusTone(status: string) {
  if (status.includes("待处理") || status.includes("已触发")) {
    return "danger" as const
  }

  if (status.includes("待复核") || status.includes("已延后")) {
    return "warning" as const
  }

  if (status.includes("已生效") || status.includes("已完成")) {
    return "success" as const
  }

  return "info" as const
}

export function SettingsLogTable({ logs }: { logs: LogRecord[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800">
      <Table>
        <TableHeader className="bg-slate-50/80 dark:bg-slate-900/70">
          <TableRow>
            <TableHead>类别</TableHead>
            <TableHead>摘要</TableHead>
            <TableHead>项目</TableHead>
            <TableHead>执行方</TableHead>
            <TableHead>时间</TableHead>
            <TableHead>状态</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id} className="bg-white/90 dark:bg-slate-950/70">
              <TableCell>{log.category}</TableCell>
              <TableCell className="max-w-[420px] text-sm leading-6 text-slate-600 dark:text-slate-300">{log.summary}</TableCell>
              <TableCell>{log.projectName ?? "平台级"}</TableCell>
              <TableCell>{log.actor}</TableCell>
              <TableCell>{log.timestamp}</TableCell>
              <TableCell>
                <StatusBadge tone={getStatusTone(log.status)}>{log.status}</StatusBadge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
