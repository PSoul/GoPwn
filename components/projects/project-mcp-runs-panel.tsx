"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { McpRun, McpRunStatus, RiskLevel } from "@/lib/generated/prisma"
import { MCP_RUN_STATUS_LABELS, RISK_LEVEL_LABELS, PHASE_LABELS, STOP_REASON_LABELS } from "@/lib/types/labels"
import { apiFetch } from "@/lib/infra/api-client"
import { useReactSteps } from "@/lib/hooks/use-react-steps"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

const statusTone: Record<McpRunStatus, Tone> = {
  pending: "warning",
  scheduled: "info",
  running: "info",
  succeeded: "success",
  failed: "danger",
  cancelled: "neutral",
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const riskTone: Record<RiskLevel, Tone> = {
  low: "success",
  medium: "warning",
  high: "danger",
}

type StepRun = McpRun & {
  stepIndex?: number | null
  thought?: string | null
  functionArgs?: unknown
}

type RoundGroup = {
  round: number
  phase: string
  runs: StepRun[]
  stopReason?: string | null
}

function groupByRound(runs: StepRun[]): RoundGroup[] {
  const map = new Map<number, StepRun[]>()
  for (const run of runs) {
    const r = run.round ?? 0
    if (!map.has(r)) map.set(r, [])
    map.get(r)!.push(run)
  }
  const groups: RoundGroup[] = []
  for (const [round, roundRuns] of map) {
    roundRuns.sort((a, b) => (a.stepIndex ?? 999) - (b.stepIndex ?? 999))
    groups.push({
      round,
      phase: roundRuns[0]?.phase ?? "recon",
      runs: roundRuns,
    })
  }
  groups.sort((a, b) => b.round - a.round)
  return groups
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

  const { activeSteps, roundProgress, connected } = useReactSteps(projectId)
  const roundGroups = groupByRound(runs as StepRun[])

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
        title="ReAct 执行步骤"
        description={connected ? "实时更新中" : "每一轮 ReAct 循环的工具调用步骤。"}
      >
        <div className="space-y-4">
          {/* Live round progress bar */}
          {roundProgress && (
            <div className="rounded-xl border border-sky-200/80 bg-sky-50/80 px-4 py-3 dark:border-sky-900/60 dark:bg-sky-950/30">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-sky-700 dark:text-sky-300">
                  R{roundProgress.round} 执行中
                </span>
                <span className="text-sky-600 dark:text-sky-400">
                  {roundProgress.currentStep}/{roundProgress.maxSteps} 步
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sky-100 dark:bg-sky-900">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, (roundProgress.currentStep / roundProgress.maxSteps) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Live active steps (from SSE, not yet in DB) */}
          {activeSteps.filter((s) => s.status === "running").map((step) => (
            <div
              key={`live-${step.round}-${step.stepIndex}`}
              className="animate-pulse rounded-xl border border-sky-200/80 bg-white/90 p-4 dark:border-sky-800 dark:bg-slate-950/70"
            >
              <div className="flex items-center gap-2 text-xs text-sky-600 dark:text-sky-400">
                <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
                Step {step.stepIndex} — {step.toolName}({step.target}) 执行中...
              </div>
              {step.thought && (
                <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">
                  {step.thought}
                </p>
              )}
            </div>
          ))}

          {/* Round groups from DB */}
          {roundGroups.length > 0 ? (
            (expanded ? roundGroups : roundGroups.slice(0, 3)).map((group) => (
              <RoundStepGroup key={group.round} group={group} />
            ))
          ) : (
            <div className="rounded-panel border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
              当前项目还没有 MCP 运行记录。
            </div>
          )}
          {roundGroups.length > 3 && (
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
                <>展开全部 {roundGroups.length} 轮 <ChevronDown className="ml-1.5 h-3.5 w-3.5" /></>
              )}
            </Button>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

function RoundStepGroup({ group }: { group: RoundGroup }) {
  const [open, setOpen] = useState(false)
  const isReact = group.runs.some((r) => r.stepIndex != null)

  const headerLabel = isReact
    ? `Round ${group.round} — ReAct — ${group.runs.length} 步${group.stopReason ? ` — ${STOP_REASON_LABELS[group.stopReason] ?? group.stopReason}` : ""}`
    : `Round ${group.round} — ${group.runs.length} 次运行`

  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <StatusBadge tone="info">{PHASE_LABELS[group.phase as keyof typeof PHASE_LABELS] ?? group.phase}</StatusBadge>
          <span className="font-medium text-slate-900 dark:text-white">{headerLabel}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-200/80 px-4 py-3 dark:border-slate-800">
          <div className="space-y-2">
            {group.runs.map((run, idx) => (
              <StepItem key={run.id} run={run} index={idx} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StepItem({ run, index }: { run: StepRun; index: number }) {
  const [showOutput, setShowOutput] = useState(false)
  const stepLabel = run.stepIndex != null ? `Step ${run.stepIndex}` : `#${index + 1}`
  const statusIcon = run.status === "succeeded" ? "\u2705" : run.status === "failed" ? "\u274c" : run.status === "running" ? "\u23f3" : "\u2b1c"

  return (
    <div className="rounded-lg border border-slate-200/60 bg-white/90 p-3 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-xs">{statusIcon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-900 dark:text-white">{stepLabel}</span>
            <span className="text-sky-600 dark:text-sky-400">{run.toolName}</span>
            <span className="text-slate-500 dark:text-slate-400">{"\u2192"} {run.target}</span>
            <StatusBadge tone={statusTone[run.status]}>{MCP_RUN_STATUS_LABELS[run.status]}</StatusBadge>
          </div>

          {run.thought && (
            <p className="mt-1.5 text-xs italic leading-5 text-slate-500 dark:text-slate-400">
              {"\ud83d\udcad"} {run.thought}
            </p>
          )}

          {run.rawOutput && (
            <div className="mt-2">
              <button
                type="button"
                className="text-xs text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
                onClick={() => setShowOutput((v) => !v)}
              >
                {showOutput ? "收起输出" : "查看输出"}
              </button>
              {showOutput && (
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {run.rawOutput}
                </pre>
              )}
            </div>
          )}

          {run.error && (
            <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
              错误: {run.error}
            </p>
          )}

          {run.completedAt && run.startedAt && (
            <p className="mt-1 text-xs text-slate-400">
              耗时 {((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(1)}s
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
