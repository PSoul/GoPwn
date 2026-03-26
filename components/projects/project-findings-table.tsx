import Link from "next/link"

import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ProjectFindingRecord } from "@/lib/prototype-types"

const severityTone = {
  高危: "danger",
  中危: "warning",
  低危: "info",
  情报: "neutral",
} as const

const statusTone = {
  待验证: "danger",
  已确认: "success",
  待复核: "warning",
  已缓解: "neutral",
} as const

function getTraceHref(record: ProjectFindingRecord) {
  return record.evidenceId.startsWith("EV-") ? `/evidence/${record.evidenceId}` : "/approvals"
}

export function ProjectFindingsTable({ findings }: { findings: ProjectFindingRecord[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800">
      <Table>
        <TableHeader className="bg-slate-50/80 dark:bg-slate-900/70">
          <TableRow>
            <TableHead>漏洞 / 发现</TableHead>
            <TableHead>影响面</TableHead>
            <TableHead>严重级别</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>追踪</TableHead>
            <TableHead>更新时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {findings.map((finding) => (
            <TableRow key={finding.id} className="bg-white/90 dark:bg-slate-950/70">
              <TableCell className="min-w-[320px]">
                <p className="font-medium text-slate-950 dark:text-white">{finding.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{finding.summary}</p>
              </TableCell>
              <TableCell>{finding.affectedSurface}</TableCell>
              <TableCell>
                <StatusBadge tone={severityTone[finding.severity]}>{finding.severity}</StatusBadge>
              </TableCell>
              <TableCell>
                <StatusBadge tone={statusTone[finding.status]}>{finding.status}</StatusBadge>
              </TableCell>
              <TableCell>
                <Link href={getTraceHref(finding)} className="text-sm font-medium text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
                  {finding.evidenceId}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                {finding.owner} · {finding.updatedAt}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
