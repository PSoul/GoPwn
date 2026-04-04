"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ChevronDown, FileCheck2, Search, Shield, ShieldAlert } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiFetch } from "@/lib/infra/api-client"
import type { VulnCenterSummaryPayload } from "@/lib/prototype-types"

const severityTone = {
  高危: "danger",
  中危: "warning",
  低危: "info",
  信息: "neutral",
} as const

const statusTone = {
  待验证: "warning",
  已确认: "danger",
  待复核: "info",
  已缓解: "success",
} as const

export default function VulnCenterPage() {
  const [data, setData] = useState<VulnCenterSummaryPayload | null>(null)
  const [keyword, setKeyword] = useState("")
  const [severityFilter, setSeverityFilter] = useState("全部")
  const [statusFilter, setStatusFilter] = useState("全部")
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/vuln-center/summary")
      if (res.ok) {
        setData(await res.json())
      }
    } catch { /* best-effort */ }
  }, [])

  useEffect(() => { void load() }, [load])

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="漏洞中心" description="跨项目漏洞总览与证据归档" />
        <div className="flex items-center justify-center py-20 text-sm text-slate-500">加载中...</div>
      </div>
    )
  }

  const normalizedKeyword = keyword.trim().toLowerCase()
  const filtered = data.findings.filter((f) => {
    if (normalizedKeyword && ![f.title, f.affectedSurface, f.projectName, f.summary].join(" ").toLowerCase().includes(normalizedKeyword)) return false
    if (severityFilter !== "全部" && f.severity !== severityFilter) return false
    if (statusFilter !== "全部" && f.status !== statusFilter) return false
    return true
  })

  const statCards = [
    { label: "漏洞总数", value: data.total, icon: Shield, tone: "neutral" as const },
    { label: "高危", value: data.bySeverity["高危"] ?? 0, icon: ShieldAlert, tone: "danger" as const, sub: `${data.pendingVerification} 待验证` },
    { label: "中危", value: data.bySeverity["中危"] ?? 0, icon: AlertTriangle, tone: "warning" as const },
    { label: "低危/信息", value: (data.bySeverity["低危"] ?? 0) + (data.bySeverity["信息"] ?? 0), icon: FileCheck2, tone: "info" as const },
  ]

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="漏洞中心"
        description="跨项目漏洞总览，一目了然看清所有待处理发现。"
        actions={
          <StatusBadge tone="warning">{data.pendingVerification} 个待验证</StatusBadge>
        }
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_12px_40px_-32px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-950/70"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{card.label}</p>
                <p className="text-3xl font-semibold text-slate-950 dark:text-white">{card.value}</p>
              </div>
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <card.icon className="h-5 w-5" />
              </div>
            </div>
            {card.sub && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="grid gap-3 xl:grid-cols-[1.3fr_0.8fr_0.8fr]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索漏洞标题、影响面、项目..."
            className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10 dark:border-slate-800 dark:bg-slate-900"
          />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
            <SelectValue placeholder="严重程度" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="全部">全部严重程度</SelectItem>
            <SelectItem value="高危">高危</SelectItem>
            <SelectItem value="中危">中危</SelectItem>
            <SelectItem value="低危">低危</SelectItem>
            <SelectItem value="信息">信息</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="全部">全部状态</SelectItem>
            <SelectItem value="待验证">待验证</SelectItem>
            <SelectItem value="已确认">已确认</SelectItem>
            <SelectItem value="待复核">待复核</SelectItem>
            <SelectItem value="已缓解">已缓解</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Vulnerability List */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950">
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
            {data.total === 0
              ? "还没有发现漏洞。等项目执行后，LLM 发现和人工验证的结果会汇总到这里。"
              : "没有匹配当前筛选条件的漏洞。"}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((finding) => (
              <div key={finding.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
                  onClick={() => toggleRow(finding.id)}
                >
                  <div className={`h-8 w-1 shrink-0 rounded-full ${
                    finding.severity === "高危" ? "bg-rose-500" :
                    finding.severity === "中危" ? "bg-amber-500" :
                    finding.severity === "低危" ? "bg-sky-500" : "bg-slate-400"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-950 dark:text-white">{finding.title}</span>
                      <StatusBadge tone={severityTone[finding.severity]}>{finding.severity}</StatusBadge>
                      <StatusBadge tone={statusTone[finding.status] ?? "neutral"}>{finding.status}</StatusBadge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>{finding.projectName}</span>
                      <span>{finding.affectedSurface}</span>
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expandedRows.has(finding.id) ? "rotate-180" : ""}`} />
                </button>

                {expandedRows.has(finding.id) && (
                  <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/30">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">摘要</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{finding.summary || "暂无摘要"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">负责人</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{finding.owner || "未指定"}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button asChild size="sm" variant="outline" className="rounded-full">
                        <Link href={`/projects/${finding.projectId}`}>查看项目漏洞</Link>
                      </Button>
                      {finding.evidenceId && (
                        <Button asChild size="sm" variant="ghost" className="rounded-full">
                          <Link href={`/projects/${finding.projectId}/context`}>查看证据</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
