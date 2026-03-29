"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeft, ShieldAlert } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
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
import type { ProjectFindingRecord } from "@/lib/prototype-types"
import { apiFetch } from "@/lib/api-client"

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

const statusOptions: ProjectFindingRecord["status"][] = ["待验证", "已确认", "待复核", "已缓解"]

function getTraceHref(record: ProjectFindingRecord) {
  return record.evidenceId.startsWith("EV-") ? `/evidence/${record.evidenceId}` : "/approvals"
}

export function ProjectFindingsTable({
  findings: initialFindings,
  projectId,
  projectStatus,
}: {
  findings: ProjectFindingRecord[]
  projectId: string
  projectStatus?: string
}) {
  const router = useRouter()
  const [findings, setFindings] = useState(initialFindings)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function handleStatusChange(findingId: string, status: ProjectFindingRecord["status"]) {
    setUpdatingId(findingId)
    try {
      const res = await apiFetch(`/api/projects/${projectId}/results/findings`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ findingId, status }),
      })
      if (res.ok) {
        const { finding } = await res.json()
        setFindings((prev) => prev.map((f) => (f.id === findingId ? finding : f)))
        router.refresh()
      }
    } catch { /* best-effort */ } finally {
      setUpdatingId(null)
    }
  }

  if (findings.length === 0) {
    const isIdle = projectStatus === "待处理"
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-16 dark:border-slate-700">
        <ShieldAlert className="h-8 w-8 text-slate-300 dark:text-slate-600" />
        <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
          {isIdle ? "尚未开始测试" : "暂未发现漏洞"}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {isIdle
            ? "返回概览页点击「开始自动化测试」启动扫描流程"
            : "测试完成后发现的漏洞和安全问题将显示在此处"}
        </p>
        {isIdle && (
          <Button asChild size="sm" className="mt-4 rounded-full" variant="outline">
            <Link href={`/projects/${projectId}`}>
              <ArrowLeft className="mr-2 h-3.5 w-3.5" />
              返回概览
            </Link>
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800">
      <div className="overflow-x-auto">
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
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{finding.summary}</p>
                </TableCell>
                <TableCell>{finding.affectedSurface}</TableCell>
                <TableCell>
                  <StatusBadge tone={severityTone[finding.severity]}>{finding.severity}</StatusBadge>
                </TableCell>
                <TableCell>
                  <Select
                    value={finding.status}
                    disabled={updatingId === finding.id}
                    onValueChange={(value) => handleStatusChange(finding.id, value as ProjectFindingRecord["status"])}
                  >
                    <SelectTrigger className="h-8 w-[100px] rounded-lg border-slate-200 text-xs dark:border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          <StatusBadge tone={statusTone[opt]}>{opt}</StatusBadge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
    </div>
  )
}
