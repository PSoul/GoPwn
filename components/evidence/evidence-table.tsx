import Link from "next/link"
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
import type { EvidenceRecord } from "@/lib/prototype-types"

export function EvidenceTable({ records }: { records: EvidenceRecord[] }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="搜索证据标题、项目、审批单号或资产..."
            className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10 dark:border-slate-800 dark:bg-slate-900"
          />
        </div>
        <Input
          value="结论筛选：待复核问题"
          readOnly
          className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
        />
        <Input
          value="来源筛选：截图 / 响应链路 / Banner"
          readOnly
          className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800">
        <Table>
          <TableHeader className="bg-slate-50/80 dark:bg-slate-900/70">
            <TableRow>
              <TableHead>证据编号</TableHead>
              <TableHead>标题</TableHead>
              <TableHead>项目</TableHead>
              <TableHead>来源</TableHead>
              <TableHead>关联审批</TableHead>
              <TableHead>置信度</TableHead>
              <TableHead>结论</TableHead>
              <TableHead className="text-right">详情</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id} className="bg-white/90 dark:bg-slate-950/70">
                <TableCell className="font-medium text-slate-950 dark:text-white">{record.id}</TableCell>
                <TableCell className="max-w-xs text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {record.title}
                </TableCell>
                <TableCell>{record.projectName}</TableCell>
                <TableCell>{record.source}</TableCell>
                <TableCell>{record.linkedApprovalId}</TableCell>
                <TableCell>{record.confidence}</TableCell>
                <TableCell>
                  <StatusBadge tone="warning">{record.conclusion}</StatusBadge>
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="outline" size="sm" className="rounded-full border-slate-300 dark:border-slate-700">
                    <Link href={`/evidence/${record.id}`}>查看证据</Link>
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
