"use client"

import { useState } from "react"
import { Bot, ChevronDown, ChevronUp, Router, ShieldCheck } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { StubBadge } from "@/components/ui/stub-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { McpRunRecord, McpWorkflowSmokePayload } from "@/lib/prototype-types"
import { apiFetch } from "@/lib/api-client"

const capabilityPresets: Record<string, { requestedAction: string; riskLevel: "高" | "中" | "低" }> = {
  "目标解析类": { requestedAction: "标准化种子目标", riskLevel: "低" },
  "DNS / 子域 / 证书情报类": { requestedAction: "补采证书与子域情报", riskLevel: "低" },
  "端口探测类": { requestedAction: "补采开放端口清单", riskLevel: "中" },
  "Web 页面探测类": { requestedAction: "补采页面入口与响应特征", riskLevel: "低" },
  "HTTP / API 结构发现类": { requestedAction: "识别 API 与文档暴露面", riskLevel: "中" },
  "接口识别类": { requestedAction: "识别 API 与文档暴露面", riskLevel: "中" },
  "受控验证类": { requestedAction: "受控验证候选项", riskLevel: "高" },
  "截图与证据采集类": { requestedAction: "采集关键页面证据", riskLevel: "中" },
  "报告导出类": { requestedAction: "导出结果报告包", riskLevel: "低" },
}

const statusTone: Record<McpRunRecord["status"], "neutral" | "info" | "success" | "warning" | "danger"> = {
  待审批: "warning",
  执行中: "info",
  已执行: "success",
  已阻塞: "danger",
  已拒绝: "neutral",
  已延后: "warning",
  已取消: "neutral",
}

const riskTone: Record<McpRunRecord["riskLevel"], "success" | "warning" | "danger"> = {
  低: "success",
  中: "warning",
  高: "danger",
}

function getPreset(capability: string) {
  return capabilityPresets[capability] ?? { requestedAction: "发起 MCP 调度请求", riskLevel: "中" as const }
}

export function ProjectMcpRunsPanel({
  projectId,
  defaultTarget,
  capabilities,
  initialRuns,
  readOnlyReason,
}: {
  projectId: string
  defaultTarget: string
  capabilities: string[]
  initialRuns: McpRunRecord[]
  readOnlyReason?: string
}) {
  const defaultCapability = capabilities[0] ?? "Web 页面探测类"
  const preset = getPreset(defaultCapability)
  const [runs, setRuns] = useState(initialRuns)
  const [capability, setCapability] = useState(defaultCapability)
  const [requestedAction, setRequestedAction] = useState(preset.requestedAction)
  const [target, setTarget] = useState(defaultTarget)
  const [riskLevel, setRiskLevel] = useState<"高" | "中" | "低">(preset.riskLevel)
  const [expanded, setExpanded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [workflowSummary, setWorkflowSummary] = useState<string[] | null>(null)
  const isReadOnly = Boolean(readOnlyReason)

  async function submitDispatch() {
    if (isReadOnly) {
      return
    }

    setIsSubmitting(true)
    setMessage(null)
    setErrorMessage(null)
    setWorkflowSummary(null)

    try {
      const response = await apiFetch(`/api/projects/${projectId}/mcp-runs`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          capability,
          requestedAction,
          target,
          riskLevel,
        }),
      })
      const payload = (await response.json()) as {
        run?: McpRunRecord
        approval?: { id: string }
        error?: string
      }

      if (!response.ok || !payload.run) {
        setErrorMessage(payload.error ?? "MCP 调度请求失败，请稍后再试。")
        return
      }

      setRuns((current) => [payload.run as McpRunRecord, ...current])
      setMessage(
        payload.approval
          ? `调度已进入审批：${payload.approval.id}，批准前不会调用目标侧 MCP。`
          : `调度已执行：${payload.run.toolName} 已接管该动作。`,
      )
    } catch {
      setErrorMessage("MCP 调度请求失败，请稍后再试。")
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleCapabilityChange(nextCapability: string) {
    const nextPreset = getPreset(nextCapability)

    setCapability(nextCapability)
    setRequestedAction(nextPreset.requestedAction)
    setRiskLevel(nextPreset.riskLevel)
    setMessage(null)
    setErrorMessage(null)
  }

  async function runWorkflowSmoke(scenario: "baseline" | "with-approval") {
    if (isReadOnly) {
      return
    }

    setIsSubmitting(true)
    setMessage(null)
    setErrorMessage(null)
    setWorkflowSummary(null)

    try {
      const response = await apiFetch(`/api/projects/${projectId}/mcp-workflow/smoke-run`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ scenario }),
      })
      const payload = (await response.json()) as
        | (McpWorkflowSmokePayload & { error?: string })
        | { error?: string }

      if (!response.ok || !("workflowId" in payload)) {
        setErrorMessage(payload.error ?? "MCP 基础流程自检失败，请稍后再试。")
        return
      }

      const nextRuns = [...payload.runs].reverse()
      setRuns((current) => [...nextRuns, ...current])
      setWorkflowSummary(
        payload.outputs.reportDigest ??
          [
            `标准化目标 ${payload.outputs.normalizedTargets?.length ?? 0} 个`,
            `发现子域 ${payload.outputs.discoveredSubdomains?.length ?? 0} 个`,
            `识别入口 ${payload.outputs.webEntries?.length ?? 0} 个`,
          ],
      )
      setMessage(
        payload.status === "completed"
          ? "基础流程自检已完成，低风险链路可以自动走通。"
          : `流程已在审批点停下：${payload.approval?.id ?? payload.blockedRun?.id ?? "待确认"}。`,
      )
    } catch {
      setErrorMessage("MCP 基础流程自检失败，请稍后再试。")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
      <SectionCard
        title="MCP 调度请求"
        description="LLM 负责决定下一步要什么能力，MCP 网关负责挑选工具、套用边界、判断是否需要审批。"
      >
        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Bot className="h-4 w-4" />
              <p className="text-sm font-semibold">编排输入</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              这里不是直接选具体工具，而是先声明所需能力，再让网关决定具体由哪个 MCP 承接。
            </p>
          </div>

          <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-sm font-semibold text-slate-950 dark:text-white">基础流程自检</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              用几类最基础的 MCP 工具把整条链路串一遍，验证“自动执行”和“审批阻塞”两种主路径都能被平台正确处理。
            </p>
            {readOnlyReason ? (
              <div className="mt-4 rounded-[20px] border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                {readOnlyReason}
              </div>
            ) : null}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button type="button" disabled={isSubmitting || isReadOnly} variant="outline" className="rounded-full" onClick={() => runWorkflowSmoke("baseline")}>
                运行基础流程
              </Button>
              <Button type="button" disabled={isSubmitting || isReadOnly} variant="outline" className="rounded-full" onClick={() => runWorkflowSmoke("with-approval")}>
                运行含审批流程
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-950 dark:text-white">能力族</p>
            <Select value={capability} onValueChange={handleCapabilityChange} disabled={isReadOnly}>
              <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                <SelectValue placeholder="选择能力族" />
              </SelectTrigger>
              <SelectContent>
                {capabilities.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-950 dark:text-white">请求动作</p>
            <Input
              value={requestedAction}
              onChange={(event) => setRequestedAction(event.target.value)}
              disabled={isReadOnly}
              className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-950 dark:text-white">目标</p>
            <Input
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              disabled={isReadOnly}
              className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-950 dark:text-white">风险级别</p>
            <div className="flex flex-wrap gap-2">
              {(["低", "中", "高"] as const).map((item) => (
                <Button
                  key={item}
                  type="button"
                  disabled={isReadOnly}
                  variant={riskLevel === item ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setRiskLevel(item)}
                >
                  风险 {item}
                </Button>
              ))}
            </div>
          </div>

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

          {workflowSummary ? (
            <div className="rounded-[20px] border border-slate-200/80 bg-white/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
              <p className="text-sm font-semibold text-slate-950 dark:text-white">最近一次流程摘要</p>
              <div className="mt-2 space-y-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {workflowSummary.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 rounded-[24px] border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
            <div>
              <p className="text-sm font-semibold text-slate-950 dark:text-white">网关策略提示</p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                低风险动作更容易自动执行，中高风险动作默认会进入审批，除非项目和全局策略明确放开。
              </p>
            </div>
            <Button type="button" disabled={isSubmitting || isReadOnly} className="rounded-full" onClick={submitDispatch}>
              {isSubmitting ? "提交中..." : "发起 MCP 调度"}
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="最近 MCP 运行"
        description="每一次请求都会留下运行记录。批准前只排队，不会直接把高风险动作打到目标上。"
      >
        <div className="space-y-3">
          {runs.length > 0 ? (
            (expanded ? runs : runs.slice(0, 3)).map((run) => (
              <div
                key={run.id}
                className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60"
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
                    <StatusBadge tone={statusTone[run.status]}>{run.status}</StatusBadge>
                    <StatusBadge tone={riskTone[run.riskLevel]}>风险 {run.riskLevel}</StatusBadge>
                    <StubBadge mode={run.connectorMode ?? "local"} />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-[20px] border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                      <ShieldCheck className="h-4 w-4" />
                      <p className="text-sm font-semibold">执行承载</p>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-950 dark:text-white">{run.toolName}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {run.dispatchMode} · {run.createdAt}
                    </p>
                    {run.linkedApprovalId ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">关联审批：{run.linkedApprovalId}</p>
                    ) : null}
                  </div>

                  <div className="rounded-[20px] border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">结果摘要</p>
                    <div className="mt-2 space-y-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {run.summaryLines.map((line) => (
                        <p key={`${run.id}-${line}`}>{line}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
              当前项目还没有 MCP 运行记录，可以先发起一次低风险补采或结果刷新。
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
