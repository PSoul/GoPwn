"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ClipboardCheck, Search, ShieldAlert, TimerReset, Workflow } from "lucide-react"

import { ApprovalDetailSheet } from "@/components/approvals/approval-detail-sheet"
import { ApprovalList } from "@/components/approvals/approval-list"
import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ApprovalRecord } from "@/lib/prototype-types"

const statIcons = [ClipboardCheck, ShieldAlert, TimerReset, Workflow]
const statusFilters = ["全部", "待处理", "已延后", "已批准", "已拒绝"] as const
const riskFilters = ["全部", "高", "中", "低"] as const

export function ApprovalCenterClient({ initialApprovals }: { initialApprovals: ApprovalRecord[] }) {
  const [approvals, setApprovals] = useState(initialApprovals)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("全部")
  const [riskFilter, setRiskFilter] = useState<(typeof riskFilters)[number]>("全部")
  const [selectedApprovalId, setSelectedApprovalId] = useState(initialApprovals[0]?.id ?? "")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const filteredApprovals = approvals.filter((approval) => {
    const normalizedQuery = query.trim().toLowerCase()
    const matchesQuery =
      normalizedQuery.length === 0 ||
      [approval.id, approval.projectName, approval.target, approval.tool, approval.actionType]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    const matchesStatus = statusFilter === "全部" || approval.status === statusFilter
    const matchesRisk = riskFilter === "全部" || approval.riskLevel === riskFilter

    return matchesQuery && matchesStatus && matchesRisk
  })
  const selectedApproval =
    filteredApprovals.find((approval) => approval.id === selectedApprovalId) ?? filteredApprovals[0] ?? null
  const pendingCount = approvals.filter((approval) => approval.status === "待处理").length
  const highRiskCount = approvals.filter((approval) => approval.riskLevel === "高").length
  const blockedProjects = new Set(
    approvals.filter((approval) => approval.status === "待处理").map((approval) => approval.projectName),
  ).size
  const delayedCount = approvals.filter((approval) => approval.status === "已延后").length
  const stats = [
    { label: "待处理队列", value: String(pendingCount), detail: "优先处理直接阻塞项目主路径的动作。" },
    { label: "高风险动作", value: String(highRiskCount), detail: "需要人工明确判断停止条件与前置约束。" },
    { label: "受阻项目", value: String(blockedProjects), detail: "跨项目阻塞统一在这里清理。" },
    { label: "已延后", value: String(delayedCount), detail: "仍需在窗口期内回看，不应长期挂起。" },
  ]

  useEffect(() => {
    if (selectedApproval && selectedApproval.id !== selectedApprovalId) {
      setSelectedApprovalId(selectedApproval.id)
    }
  }, [selectedApproval, selectedApprovalId])

  async function handleDecision(decision: ApprovalRecord["status"]) {
    if (!selectedApproval) {
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const response = await fetch(`/api/approvals/${selectedApproval.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ decision }),
      })
      const payload = (await response.json()) as { approval?: ApprovalRecord; error?: string }

      if (!response.ok || !payload.approval) {
        setErrorMessage(payload.error ?? "审批状态更新失败，请稍后再试。")
        return
      }

      setApprovals((current) =>
        current.map((approval) => (approval.id === payload.approval?.id ? payload.approval : approval)),
      )
      setSelectedApprovalId(payload.approval.id)
      setSuccessMessage(`审批单 ${payload.approval.id} 已更新为“${payload.approval.status}”。`)
    } catch {
      setErrorMessage("审批状态更新失败，请稍后再试。")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="审批中心"
        description="审批中心作为全局一级入口，负责清理跨项目的高风险动作阻塞。先看影响面，再看具体工具和停止条件。"
        actions={
          <>
            <StatusBadge tone="danger">{pendingCount} 个待处理</StatusBadge>
            <Button asChild className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400">
              <Link href="/projects">回到项目主路径</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = statIcons[index]

          return (
            <div
              key={stat.label}
              className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_12px_40px_-32px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-950/70"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{stat.label}</p>
                  <p className="text-3xl font-semibold text-slate-950 dark:text-white">{stat.value}</p>
                </div>
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{stat.detail}</p>
            </div>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="待处理审批"
          eyebrow="Approval Queue"
          description="默认按待处理、风险等级和阻塞影响排序，细节抽屉里给出参数摘要、执行前提和停止条件。"
        >
          <div className="space-y-5">
            <div className="grid gap-4 rounded-3xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索审批单号、项目、目标或工具..."
                  className="h-11 rounded-2xl border-slate-200 bg-white pl-10 dark:border-slate-800 dark:bg-slate-950"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {statusFilters.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    variant={statusFilter === item ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setStatusFilter(item)}
                  >
                    {item}
                  </Button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {riskFilters.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    variant={riskFilter === item ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setRiskFilter(item)}
                  >
                    风险 {item}
                  </Button>
                ))}
              </div>
            </div>

            <ApprovalList
              records={filteredApprovals}
              selectedApprovalId={selectedApproval?.id}
              onSelectApproval={setSelectedApprovalId}
            />
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="队列首项详情"
            eyebrow="Approval Sheet"
            description="这里固定预览当前最值得处理的一项审批，便于快速进入判断。"
          >
            {selectedApproval ? (
              <ApprovalDetailSheet approval={selectedApproval} isSubmitting={isSubmitting} onDecision={handleDecision} />
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                当前筛选条件下没有可查看的审批。
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="决策原则"
            eyebrow="Review Rules"
            description="审批不是单纯点击通过，而是判断当前环境、证据链完整度和风险暴露窗口。"
          >
            <div className="space-y-4">
              {successMessage ? (
                <div className="rounded-3xl border border-emerald-200/80 bg-emerald-50/80 p-4 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                  {successMessage}
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-3xl border border-rose-200/80 bg-rose-50/80 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
                  {errorMessage}
                </div>
              ) : null}

              {[
                "先处理正在阻塞项目主路径的高风险动作，再看补充性验证。",
                "必须先确认范围与证据采集链路健康，再批准进入受控 PoC。",
                "当工具健康异常或环境波动明显时，宁可延后也不要冒进。",
              ].map((rule) => (
                <div
                  key={rule}
                  className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300"
                >
                  {rule}
                </div>
              ))}

              <div className="rounded-3xl border border-rose-200/80 bg-rose-50/80 p-5 dark:border-rose-900/60 dark:bg-rose-950/20">
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-200">当前提醒</p>
                <p className="mt-2 text-sm leading-6 text-rose-700/90 dark:text-rose-100/90">
                  capture-evidence 当前异常，高风险动作审批需要同时确认是否允许降级采证，避免出现“动作执行了但证据链断掉”的情况。
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
