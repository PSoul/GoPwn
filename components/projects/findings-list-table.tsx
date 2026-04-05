"use client"

import { useRouter } from "next/navigation"

import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Finding, Severity } from "@/lib/generated/prisma"
import { SEVERITY_LABELS } from "@/lib/types/labels"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

const severityTone: Record<Severity, Tone> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "info",
  info: "neutral",
}

type Props = {
  projectId: string
  findings: Finding[]
}

export function FindingsListTable({ projectId, findings }: Props) {
  const router = useRouter()

  if (findings.length === 0) {
    return <p className="text-sm text-zinc-600 py-8 text-center">暂无安全发现</p>
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-50/80 dark:bg-slate-900/70">
            <TableRow>
              <TableHead>漏洞标题</TableHead>
              <TableHead>严重级别</TableHead>
              <TableHead>影响目标</TableHead>
              <TableHead>发现时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {findings.map((finding) => (
              <TableRow
                key={finding.id}
                className="cursor-pointer bg-white/90 transition-colors hover:bg-slate-50 dark:bg-slate-950/70 dark:hover:bg-slate-900/70"
                onClick={() => router.push(`/projects/${projectId}/vuln/${finding.id}`)}
              >
                <TableCell className="min-w-[320px]">
                  <p className="font-medium text-slate-950 dark:text-white">{finding.title}</p>
                  {finding.summary && (
                    <p className="mt-1 text-sm text-slate-500 line-clamp-1">{finding.summary}</p>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={severityTone[finding.severity]}>{SEVERITY_LABELS[finding.severity]}</StatusBadge>
                </TableCell>
                <TableCell className="text-sm font-mono text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
                  {finding.affectedTarget}
                </TableCell>
                <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                  {new Date(finding.createdAt).toLocaleDateString("zh-CN")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
