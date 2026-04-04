"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Router, ShieldCheck } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { McpRun, McpRunStatus, RiskLevel } from "@/lib/generated/prisma"
import { MCP_RUN_STATUS_LABELS, RISK_LEVEL_LABELS, PHASE_LABELS } from "@/lib/types/labels"
import { apiFetch } from "@/lib/infra/api-client"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

const statusTone: Record<McpRunStatus, Tone> = {
  pending: "warning",
  scheduled: "info",
  running: "info",
  succeeded: "success",
  failed: "danger",
  cancelled: "neutral",
}

const riskTone: Record<RiskLevel, Tone> = {
  low: "success",
  medium: "warning",
  high: "danger",
}

export function ProjectMcpRunsPanel({
  projectId,
  defaultTarget,
  initialRuns,
  readOnlyReason,
}: {
  projectId: string
  defaultTarget: string
  initialRuns: McpRun[]
  readOnlyReason?: string
}) {
  const [runs, setRuns] = useState(initialRuns)
  const [capability, setCapability] = useState("")
  const [requestedAction, setRequestedAction] = useState("")
  const [target, setTarget] = useState(defaultTarget)
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("medium")
  const [expanded, setExpanded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isReadOnly = Boolean(readOnlyReason)

  async function submitDispatch() {
    if (isReadOnly) return

    setIsSubmitting(true)
    setMessage(null)
    setErrorMessage(null)

    try {
      const payload = await apiFetch<{ run?: McpRun; approval?: { id: string }; error?: string }>(
        `/api/projects/${projectId}/mcp-runs`,
        {
          method: "POST",
          body: JSON.stringify({ capability, requestedAction, target, riskLevel }),
        },
      )

      if (!payload.run) {
        setErrorMessage(payload.error ?? "MCP 调度请求失败，请稍后再试。")
        return
      }

      setRuns((current) => [payload.run as McpRun, ...current])
      setMessage(
        payload.approval
          ? `调度已进入审批：${payload.approval.id}。`
          : `调度已执行：${payload.run.toolName} 已接管该动作。`,
      )
    } catch {
      setErrorMessage("MCP 调度请求失败，请稍后再试。")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
      <SectionCard
        title="MCP 调度请求"
        description="声明所需能力，由 MCP 网关决定具体工具。"
      >
        <div className="space-y-4">
          {readOnlyReason ? (
            <div className="rounded-item border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              {readOnlyReason}
            </div>
          ) : null}

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-950 dark:text-white">能力</p>
            <Input
              value={capability}
              onChange={(e) => setCapability(e.target.value)}
              disabled={isReadOnly}
              placeholder="例如：DNS / 子域 / 证书情报类"
              className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-950 dark:text-white">请求动作</p>
            <Input
              value={requestedAction}
              onChange={(e) => setRequestedAction(e.target.value)}
              disabled={isReadOnly}
              className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-950 dark:text-white">目标</p>
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={isReadOnly}
              className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-950 dark:text-white">风险级别</p>
            <div className="flex flex-wrap gap-2">
              {(["low", "medium", "high"] as const).map((item) => (
                <Button
                  key={item}
                  type="button"
                  disabled={isReadOnly}
                  variant={riskLevel === item ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setRiskLevel(item)}
                >
                  {RISK_LEVEL_LABELS[item]}
                </Button>
              ))}
            </div>
          </div>

          {message ? (
            <div className="rounded-item border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
              {message}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-item border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex items-center justify-end">
            <Button type="button" disabled={isSubmitting || isReadOnly} className="rounded-full" onClick={submitDispatch}>
              {isSubmitting ? "提交中..." : "发起 MCP 调度"}
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="最近 MCP 运行"
        description="每一次请求都会留下运行记录。"
      >
        <div className="space-y-3">
          {runs.length > 0 ? (
            (expanded ? runs : runs.slice(0, 3)).map((run) => (
              <div
                key={run.id}
                className="rounded-panel border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">
                      <Router className="h-3.5 w-3.5" />
                      <span>{run.capability}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{run.requestedAction}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{run.target}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={statusTone[run.status]}>{MCP_RUN_STATUS_LABELS[run.status]}</StatusBadge>
                    <StatusBadge tone={riskTone[run.riskLevel]}>{RISK_LEVEL_LABELS[run.riskLevel]}</StatusBadge>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-item border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                      <ShieldCheck className="h-4 w-4" />
                      <p className="text-sm font-semibold">执行承载</p>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-950 dark:text-white">{run.toolName}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {PHASE_LABELS[run.phase]} R{run.round} -- {new Date(run.createdAt).toLocaleString("zh-CN")}
                    </p>
                  </div>

                  <div className="rounded-item border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">结果</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {run.error ? `错误: ${run.error}` : run.rawOutput ? "已有输出" : "等待执行"}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-panel border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
              当前项目还没有 MCP 运行记录。
            </div>
          )}
          {runs.length > 3 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <>收起 <ChevronUp className="ml-1.5 h-3.5 w-3.5" /></>
              ) : (
                <>展开全部 {runs.length} 条记录 <ChevronDown className="ml-1.5 h-3.5 w-3.5" /></>
              )}
            </Button>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
