"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ShieldAlert } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Finding, FindingStatus, Severity } from "@/lib/generated/prisma"
import { SEVERITY_LABELS, FINDING_STATUS_LABELS } from "@/lib/types/labels"
import { apiFetch } from "@/lib/infra/api-client"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

const severityTone: Record<Severity, Tone> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "info",
  info: "neutral",
}

const statusTone: Record<FindingStatus, Tone> = {
  suspected: "warning",
  verifying: "info",
  verified: "success",
  false_positive: "neutral",
  remediated: "neutral",
}

const statusOptions: FindingStatus[] = ["suspected", "verifying", "verified", "false_positive", "remediated"]

export function ProjectFindingsTable({
  findings: initialFindings,
  projectId,
}: {
  findings: Finding[]
  projectId: string
}) {
  const router = useRouter()
  const [findings, setFindings] = useState(initialFindings)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function handleStatusChange(findingId: string, status: FindingStatus) {
    setUpdatingId(findingId)
    try {
      const payload = await apiFetch<{ finding: Finding }>(`/api/projects/${projectId}/results/findings`, {
        method: "PATCH",
        body: JSON.stringify({ findingId, status }),
      })
      if (payload.finding) {
        setFindings((prev) => prev.map((f) => (f.id === findingId ? payload.finding : f)))
        router.refresh()
      }
    } catch { /* best-effort */ } finally {
      setUpdatingId(null)
    }
  }

  if (findings.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <ShieldAlert className="h-8 w-8 text-slate-400 dark:text-slate-500" />
          </EmptyMedia>
          <EmptyTitle>暂无漏洞与发现</EmptyTitle>
          <EmptyDescription>项目执行后，LLM 和探测工具发现的安全问题会出现在这里。</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-50/80 dark:bg-slate-900/70">
            <TableRow>
              <TableHead>漏洞 / 发现</TableHead>
              <TableHead>影响目标</TableHead>
              <TableHead>严重级别</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>更新时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {findings.map((finding) => (
              <TableRow key={finding.id} className="bg-white/90 dark:bg-slate-950/70">
                <TableCell className="min-w-[320px]">
                  <Link href={`/projects/${projectId}/vuln/${finding.id}`} className="block">
                    <p className="font-medium text-slate-950 dark:text-white">{finding.title}</p>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{finding.summary}</p>
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-slate-700 dark:text-slate-200">
                  {finding.affectedTarget}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={severityTone[finding.severity]}>{SEVERITY_LABELS[finding.severity]}</StatusBadge>
                </TableCell>
                <TableCell>
                  <Select
                    value={finding.status}
                    disabled={updatingId === finding.id}
                    onValueChange={(value) => handleStatusChange(finding.id, value as FindingStatus)}
                  >
                    <SelectTrigger className="h-8 w-[100px] rounded-lg border-slate-200 text-xs dark:border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          <StatusBadge tone={statusTone[opt]}>{FINDING_STATUS_LABELS[opt]}</StatusBadge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                  {new Date(finding.updatedAt).toLocaleDateString("zh-CN")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
