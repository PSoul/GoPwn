"use client"

import { useState } from "react"
import { Bot, FlaskConical, ShieldCheck, Sparkles } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import type {
  LocalLabRecord,
  LocalValidationRunPayload,
  OrchestratorPlanPayload,
  ProjectOrchestratorPanelPayload,
} from "@/lib/prototype-types"

const labTone: Record<LocalLabRecord["status"], "success" | "warning" | "danger"> = {
  online: "success",
  offline: "danger",
  unknown: "warning",
}

export function ProjectOrchestratorPanel({
  projectId,
  initialPayload,
  readOnlyReason,
}: {
  projectId: string
  initialPayload: ProjectOrchestratorPanelPayload
  readOnlyReason?: string
}) {
  const [panel, setPanel] = useState(initialPayload)
  const [busyLabId, setBusyLabId] = useState<string | null>(null)
  const [includeHighRisk, setIncludeHighRisk] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isReadOnly = Boolean(readOnlyReason)

  function updateLabStatus(nextLab: LocalLabRecord) {
    setPanel((current) => ({
      ...current,
      localLabs: current.localLabs.map((lab) => (lab.id === nextLab.id ? nextLab : lab)),
    }))
  }

  async function generatePlan(lab: LocalLabRecord) {
    if (isReadOnly) {
      return
    }

    setBusyLabId(lab.id)
    setMessage(null)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/orchestrator/plan`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          labId: lab.id,
          approvalScenario: includeHighRisk ? "include-high-risk" : "none",
        }),
      })
      const payload = (await response.json()) as (OrchestratorPlanPayload & { error?: string }) | { error?: string }

      if (!response.ok || !("plan" in payload)) {
        setErrorMessage(payload.error ?? "编排计划生成失败，请稍后再试。")
        return
      }

      setPanel((current) => ({
        ...current,
        provider: payload.provider,
        lastPlan: payload.plan,
      }))
      setMessage(`已为 ${lab.name} 刷新本地编排计划。`)
    } catch {
      setErrorMessage("编排计划生成失败，请稍后再试。")
    } finally {
      setBusyLabId(null)
    }
  }

  async function runLocalValidation(lab: LocalLabRecord) {
    if (isReadOnly) {
      return
    }

    setBusyLabId(lab.id)
    setMessage(null)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/orchestrator/local-validation`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          labId: lab.id,
          approvalScenario: includeHighRisk ? "include-high-risk" : "none",
        }),
      })
      const payload = (await response.json()) as (LocalValidationRunPayload & { error?: string }) | { error?: string }

      if (!response.ok || !("plan" in payload) || !("localLab" in payload)) {
        setErrorMessage(payload.error ?? "本地闭环验证启动失败，请稍后再试。")
        return
      }

      setPanel((current) => ({
        ...current,
        provider: payload.provider,
        lastPlan: payload.plan,
      }))
      updateLabStatus(payload.localLab)

      setMessage(
        payload.status === "waiting_approval"
          ? `本地闭环已运行到等待审批节点：${payload.approval?.id ?? "待确认"}。`
          : payload.status === "blocked"
            ? "本地闭环当前被阻塞，请先检查靶场可达性、审批或能力映射。"
            : "本地闭环已完成，低风险结果与调度链路已经打通。",
      )
    } catch {
      setErrorMessage("本地闭环验证启动失败，请稍后再试。")
    } finally {
      setBusyLabId(null)
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
      <SectionCard
        title="LLM 编排与本地闭环"
        description="这里专门验证“LLM 先规划、MCP 再落地”的主路径，并用本地靶场演练审批暂停与恢复。"
      >
        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Bot className="h-4 w-4" />
              <p className="text-sm font-semibold">编排提供方</p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge tone={panel.provider.enabled ? "success" : "warning"}>
                {panel.provider.enabled ? "真实 LLM 已接入" : "本地回退模式"}
              </StatusBadge>
              <StatusBadge tone="info">{panel.provider.provider}</StatusBadge>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{panel.provider.note}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                <p className="text-xs text-slate-500 dark:text-slate-400">编排模型</p>
                <p className="mt-1 text-sm font-medium text-slate-950 dark:text-white">
                  {panel.provider.orchestratorModel || "未配置"}
                </p>
              </div>
              <div className="rounded-[20px] border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                <p className="text-xs text-slate-500 dark:text-slate-400">Base URL</p>
                <p className="mt-1 text-sm font-medium text-slate-950 dark:text-white">
                  {panel.provider.baseUrl || "未配置"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-[24px] border border-slate-200/80 bg-white/90 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/70">
            <div>
              <p className="text-sm font-semibold text-slate-950 dark:text-white">审批演练开关</p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                开启后，计划中会故意夹带一条高风险动作，用来验证审批暂停与恢复链路。
              </p>
            </div>
            <Switch
              checked={includeHighRisk}
              aria-label="包含高风险审批动作"
              disabled={isReadOnly}
              onCheckedChange={setIncludeHighRisk}
            />
          </div>

          {readOnlyReason ? (
            <div className="rounded-[20px] border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              {readOnlyReason}
            </div>
          ) : null}

          {message ? (
            <div className="rounded-[20px] border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
              {message}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-[20px] border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
              {errorMessage}
            </div>
          ) : null}

          <div className="space-y-3">
            {panel.localLabs.map((lab) => {
              const isBusy = busyLabId === lab.id

              return (
                <div
                  key={lab.id}
                  className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-slate-950 dark:text-white">
                        <FlaskConical className="h-4 w-4" />
                        <p className="text-sm font-semibold">{lab.name}</p>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{lab.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge tone={labTone[lab.status]}>{lab.status}</StatusBadge>
                      <StatusBadge tone="neutral">{lab.image}</StatusBadge>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-xs text-slate-500 dark:text-slate-400">入口</p>
                      <p className="mt-1 text-sm font-medium text-slate-950 dark:text-white">{lab.baseUrl}</p>
                    </div>
                    <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-xs text-slate-500 dark:text-slate-400">端口映射</p>
                      <p className="mt-1 text-sm font-medium text-slate-950 dark:text-white">{lab.ports.join(" / ")}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      disabled={isBusy || isReadOnly}
                      variant="outline"
                      className="rounded-full"
                      aria-label={`为 ${lab.name} 生成计划`}
                      onClick={() => generatePlan(lab)}
                    >
                      {isBusy ? "处理中..." : "生成计划"}
                    </Button>
                    <Button
                      type="button"
                      disabled={isBusy || isReadOnly}
                      className="rounded-full bg-slate-950 text-white hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                      aria-label={`运行 ${lab.name} 本地验证`}
                      onClick={() => runLocalValidation(lab)}
                    >
                      {isBusy ? "处理中..." : "执行本地闭环"}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="最近一次编排计划"
        description="计划只决定下一组能力和顺序，不直接触目标。真正的外部动作仍然交给 MCP 与审批策略处理。"
      >
        {panel.lastPlan ? (
          <div className="space-y-4">
            <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="info">{panel.lastPlan.provider}</StatusBadge>
                <StatusBadge tone="neutral">{panel.lastPlan.generatedAt}</StatusBadge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{panel.lastPlan.summary}</p>
            </div>

            <div className="space-y-3">
              {panel.lastPlan.items.map((item, index) => (
                <div
                  key={`${item.capability}-${item.target}-${index}`}
                  className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-slate-950 dark:text-white">
                        <Sparkles className="h-4 w-4" />
                        <p className="text-sm font-semibold">{item.requestedAction}</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.capability}</p>
                    </div>
                    <StatusBadge tone={item.riskLevel === "高" ? "danger" : item.riskLevel === "中" ? "warning" : "success"}>
                      风险 {item.riskLevel}
                    </StatusBadge>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-xs text-slate-500 dark:text-slate-400">目标</p>
                      <p className="mt-1 text-sm font-medium text-slate-950 dark:text-white">{item.target}</p>
                    </div>
                    <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                      <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        <ShieldCheck className="h-4 w-4" />
                        <p className="text-sm font-semibold">编排理由</p>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.rationale}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
            还没有生成本地编排计划，可以先选择一个靶场做计划生成或闭环验证。
          </div>
        )}
      </SectionCard>
    </div>
  )
}
