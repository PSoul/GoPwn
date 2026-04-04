import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AuditEvent } from "@/lib/generated/prisma"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

function getCategoryTone(category: string): Tone {
  if (category.includes("approval") || category.includes("security")) return "danger"
  if (category.includes("config") || category.includes("setting")) return "warning"
  if (category.includes("project")) return "info"
  return "neutral"
}

export function SettingsLogTable({ logs }: { logs: AuditEvent[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800">
      <Table>
        <TableHeader className="bg-slate-50/80 dark:bg-slate-900/70">
          <TableRow>
            <TableHead>类别</TableHead>
            <TableHead>操作</TableHead>
            <TableHead>详情</TableHead>
            <TableHead>执行方</TableHead>
            <TableHead>时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id} className="bg-white/90 dark:bg-slate-950/70">
              <TableCell>
                <StatusBadge tone={getCategoryTone(log.category)}>{log.category}</StatusBadge>
              </TableCell>
              <TableCell className="text-sm font-medium text-slate-950 dark:text-white">{log.action}</TableCell>
              <TableCell className="max-w-[420px] text-sm leading-6 text-slate-600 dark:text-slate-300">
                {log.detail}
              </TableCell>
              <TableCell className="text-sm text-slate-600 dark:text-slate-300">{log.actor}</TableCell>
              <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                {new Date(log.createdAt).toLocaleString("zh-CN")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
