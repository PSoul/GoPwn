"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { OrchestratorPlan, OrchestratorRound } from "@/lib/generated/prisma"
import { PHASE_LABELS } from "@/lib/types/labels"

type PlanItem = {
  requestedAction?: string
  action?: string
  capability?: string
  target?: string
  riskLevel?: string
  rationale?: string
  toolName?: string
}

export function ProjectOrchestratorPanel({
  projectId,
  plans,
  rounds,
}: {
  projectId: string
  plans: OrchestratorPlan[]
  rounds: OrchestratorRound[]
}) {
  const [planExpanded, setPlanExpanded] = useState(false)
  const [roundsExpanded, setRoundsExpanded] = useState(false)

  const lastPlan = plans.length > 0 ? plans[plans.length - 1] : null
  const planItems: PlanItem[] = lastPlan?.items
    ? (Array.isArray(lastPlan.items) ? lastPlan.items as PlanItem[] : [])
    : []

  return (
    <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
      <SectionCard
        title="AI 规划轮次"
        description="每一轮由 LLM 规划下一步动作，MCP 负责执行。"
      >
        <div className="space-y-3">
          {rounds.length > 0 ? (
            (roundsExpanded ? rounds : rounds.slice(0, 5)).map((round) => (
              <div key={round.id} className="flex items-center gap-4 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                <span className="w-16 shrink-0 font-medium text-slate-900 dark:text-white">R{round.round}</span>
                <StatusBadge tone="info">{PHASE_LABELS[round.phase]}</StatusBadge>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-slate-500">计划 {round.planItemCount}</span>
                  <span className="text-xs text-slate-500">执行 {round.executedCount}</span>
                  {round.newAssetCount > 0 && <span className="text-xs text-sky-600 dark:text-sky-400">+{round.newAssetCount} 资产</span>}
                  {round.newFindingCount > 0 && <span className="text-xs text-amber-600 dark:text-amber-400">+{round.newFindingCount} 发现</span>}
                </div>
                <span className="ml-auto text-xs text-slate-400">
                  {round.completedAt ? new Date(round.completedAt).toLocaleString("zh-CN") : round.status}
                </span>
              </div>
            ))
          ) : (
            <div className="rounded-panel border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
              还没有执行轮次。
            </div>
          )}
          {rounds.length > 5 && (
            <Button variant="ghost" size="sm" className="w-full rounded-full" onClick={() => setRoundsExpanded((v) => !v)}>
              {roundsExpanded ? "收起" : `展开全部 ${rounds.length} 轮`}
            </Button>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="最近一次 AI 规划"
        description="计划只决定下一组能力和顺序，不直接触目标。"
      >
        {lastPlan ? (
          <div className="space-y-4">
            <div className="rounded-panel border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="info">{lastPlan.provider}</StatusBadge>
                <StatusBadge tone="neutral">{PHASE_LABELS[lastPlan.phase]} R{lastPlan.round}</StatusBadge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{lastPlan.summary}</p>
            </div>

            <div className="space-y-3">
              {(planExpanded ? planItems : planItems.slice(0, 3)).map((item, index) => (
                <div
                  key={`${item.capability}-${item.target}-${index}`}
                  className="rounded-panel border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-slate-950 dark:text-white">
                        <Sparkles className="h-4 w-4" />
                        <p className="text-sm font-semibold">{item.requestedAction ?? item.action}</p>
                      </div>
                      {item.capability && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.capability}</p>}
                    </div>
                    {item.riskLevel && (
                      <StatusBadge tone={item.riskLevel === "high" ? "danger" : item.riskLevel === "medium" ? "warning" : "success"}>
                        {item.riskLevel}
                      </StatusBadge>
                    )}
                  </div>
                  {item.target && (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">目标: {item.target}</p>
                  )}
                  {item.rationale && (
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.rationale}</p>
                  )}
                </div>
              ))}
              {planItems.length > 3 && (
                <Button variant="ghost" size="sm" className="w-full rounded-full" onClick={() => setPlanExpanded((v) => !v)}>
                  {planExpanded ? (
                    <>收起 <ChevronUp className="ml-1.5 h-3.5 w-3.5" /></>
                  ) : (
                    <>展开全部 {planItems.length} 步 <ChevronDown className="ml-1.5 h-3.5 w-3.5" /></>
                  )}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-panel border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
            还没有 AI 规划记录。
          </div>
        )}
      </SectionCard>
    </div>
  )
}
