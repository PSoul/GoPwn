import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ProjectInventoryGroup } from "@/lib/prototype-types"

export function ProjectInventoryTable({ group }: { group: ProjectInventoryGroup }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800">
      <Table>
        <TableHeader className="bg-slate-50/80 dark:bg-slate-900/70">
          <TableRow>
            <TableHead>对象 / 入口</TableHead>
            <TableHead>当前画像 / 说明</TableHead>
            <TableHead>分类</TableHead>
            <TableHead>当前状态</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {group.items.map((item) => (
            <TableRow key={`${group.title}-${item.primary}`} className="bg-white/90 dark:bg-slate-950/70">
              <TableCell className="font-medium text-slate-950 dark:text-white">{item.primary}</TableCell>
              <TableCell className="max-w-[520px] text-sm leading-6 text-slate-600 dark:text-slate-300">{item.secondary}</TableCell>
              <TableCell>{item.meta}</TableCell>
              <TableCell>
                <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
