"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { StatusBadge } from "@/components/shared/status-badge"
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
import { apiFetch } from "@/lib/infra/api-client"

const severityTone = {
  高危: "danger",
  中危: "warning",
  低危: "info",
  信息: "neutral",
} as const

const statusTone = {
  待验证: "danger",
  已确认: "success",
  待复核: "warning",
  已缓解: "neutral",
} as const

const statusOptions: ProjectFindingRecord["status"][] = ["待验证", "已确认", "待复核", "已缓解"]

export function ProjectVulnTab({
  projectId,
  initialFindings,
}: {
  projectId: string
  initialFindings: ProjectFindingRecord[]
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
    return (
      <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
        暂无漏洞记录
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
              <TableHead>严重级别</TableHead>
              <TableHead>影响面</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
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
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {finding.summary}
                  </p>
                </TableCell>
                <TableCell>
                  <StatusBadge tone={severityTone[finding.severity]}>{finding.severity}</StatusBadge>
                </TableCell>
                <TableCell className="text-sm text-slate-700 dark:text-slate-200">
                  {finding.affectedSurface}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={finding.status}
                    disabled={updatingId === finding.id}
                    onValueChange={(value) =>
                      handleStatusChange(finding.id, value as ProjectFindingRecord["status"])
                    }
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
                <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                  {finding.createdAt}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
