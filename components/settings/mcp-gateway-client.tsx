"use client"

import { useEffect, useState } from "react"
import { Activity, PlugZap, ShieldCheck, ShieldOff } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { McpToolTable } from "@/components/settings/mcp-tool-table"
import { apiFetch } from "@/lib/infra/api-client"
import type { McpTool, McpServer, RiskLevel } from "@/lib/generated/prisma"
import { RISK_LEVEL_LABELS } from "@/lib/types/labels"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

const riskTone: Record<RiskLevel, Tone> = {
  low: "info",
  medium: "warning",
  high: "danger",
}

export function McpGatewayClient({
  initialTools,
  initialServers,
}: {
  initialTools: McpTool[]
  initialServers: McpServer[]
}) {
  const [tools, setTools] = useState(initialTools)
  const [servers, setServers] = useState(initialServers)
  const [query, setQuery] = useState("")
  const [selectedToolId, setSelectedToolId] = useState(initialTools[0]?.id ?? "")
  const [draft, setDraft] = useState<McpTool | null>(initialTools[0] ? { ...initialTools[0] } : null)
  const [isSaving, setIsSaving] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const filteredTools = tools.filter((tool) =>
    [tool.toolName, tool.capability, tool.description].join(" ").toLowerCase().includes(query.trim().toLowerCase()),
  )
  const enabledCount = tools.filter((tool) => tool.enabled).length
  const coveredCapabilityCount = new Set(tools.map((tool) => tool.capability)).size
  const connectedServerCount = servers.filter((server) => server.enabled).length

  useEffect(() => {
    if (filteredTools.length === 0) {
      if (selectedToolId || draft) {
        setSelectedToolId("")
        setDraft(null)
      }
      return
    }

    if (!filteredTools.some((tool) => tool.id === selectedToolId)) {
      const fallbackTool = filteredTools[0]
      setSelectedToolId(fallbackTool.id)
      setDraft({ ...fallbackTool })
    }
  }, [draft, filteredTools, selectedToolId])

  function selectTool(toolId: string) {
    const nextTool = tools.find((tool) => tool.id === toolId)
    if (!nextTool) return

    setSelectedToolId(nextTool.id)
    setDraft({ ...nextTool })
    setMessage(null)
    setErrorMessage(null)
  }

  async function saveTool() {
    if (!draft) return

    setIsSaving(true)
    setMessage(null)
    setErrorMessage(null)

    try {
      const payload = await apiFetch<{ tool: McpTool }>(`/api/settings/mcp-tools/${draft.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          enabled: draft.enabled,
          requiresApproval: draft.requiresApproval,
          timeout: draft.timeout,
          description: draft.description,
        }),
      })

      if (payload.tool) {
        setTools((current) => current.map((tool) => (tool.id === payload.tool.id ? payload.tool : tool)))
        setDraft(payload.tool)
        setMessage(`探测工具 ${payload.tool.toolName} 已保存。`)
      }
    } catch {
      setErrorMessage("探测工具配置保存失败，请稍后再试。")
    } finally {
      setIsSaving(false)
    }
  }

  async function runHealthCheck() {
    if (!draft) return

    setIsChecking(true)
    setMessage(null)
    setErrorMessage(null)

    try {
      const payload = await apiFetch<{ tool: McpTool }>(`/api/settings/mcp-tools/${draft.id}/health-check`, {
        method: "POST",
      })

      if (payload.tool) {
        setTools((current) => current.map((tool) => (tool.id === payload.tool.id ? payload.tool : tool)))
        setDraft(payload.tool)
        setMessage(`已完成 ${payload.tool.toolName} 的健康巡检。`)
      }
    } catch {
      setErrorMessage("MCP 健康巡检失败，请稍后再试。")
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "已注册工具", value: String(tools.length), note: "作为网关可挑选的真实接入位", icon: PlugZap },
          { label: "已覆盖能力族", value: String(coveredCapabilityCount), note: "按能力而不是按具体工具名调度", icon: Activity },
          { label: "启用状态", value: String(enabledCount), note: "当前允许进入调度候选池的工具", icon: ShieldCheck },
          { label: "已停用", value: String(tools.length - enabledCount), note: "需要先巡检再放量", icon: ShieldOff },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{item.value}</p>
              </div>
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <item.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.note}</p>
          </div>
        ))}
      </div>

      {/* Connected servers */}
      <SectionCard title="已连接 MCP 服务器" description="展示已注册的 MCP server 及其连接状态。">
        <div className="space-y-3">
          {servers.length > 0 ? (
            servers.map((server) => (
              <div
                key={server.id}
                className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">{server.serverName}</p>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {server.transport} · {[server.command, ...server.args].join(" ")}
                    </p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{server.endpoint || "未声明 endpoint"}</p>
                  </div>
                  <StatusBadge tone={server.enabled ? "success" : "neutral"}>
                    {server.enabled ? "已启用" : "已停用"}
                  </StatusBadge>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
              当前还没有注册任何 MCP server。
            </div>
          )}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <SectionCard title="已注册探测工具" description="工具是具体接入位，平台调度时真正依赖的是能力族和注册契约。">
          <div className="space-y-5">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索工具名、能力族或说明..."
              className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
            />

            <McpToolTable tools={filteredTools} selectedToolId={selectedToolId} onSelectTool={selectTool} />
          </div>
        </SectionCard>

        <SectionCard title="工具详情与默认策略" description="查看和编辑选中工具的配置。">
          {draft ? (
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">{draft.capability}</p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">{draft.toolName}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{draft.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={draft.enabled ? "success" : "neutral"}>
                      {draft.enabled ? "已启用" : "已停用"}
                    </StatusBadge>
                    <StatusBadge tone={riskTone[draft.riskLevel]}>
                      {RISK_LEVEL_LABELS[draft.riskLevel]}
                    </StatusBadge>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-xs text-slate-500 dark:text-slate-400">调用边界</p>
                  <p className="mt-2 text-sm font-medium text-slate-950 dark:text-white">{draft.boundary}</p>
                </div>
                <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-xs text-slate-500 dark:text-slate-400">审批门槛</p>
                  <p className="mt-2 text-sm font-medium text-slate-950 dark:text-white">
                    {draft.requiresApproval ? "需要审批" : "自动执行"}
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-950 dark:text-white">超时 (ms)</span>
                  <Input
                    type="number"
                    value={String(draft.timeout)}
                    onChange={(event) => setDraft((current) => (current ? { ...current, timeout: Number(event.target.value) || current.timeout } : current))}
                    className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-950 dark:text-white">描述</span>
                  <Textarea
                    value={draft.description}
                    onChange={(event) => setDraft((current) => (current ? { ...current, description: event.target.value } : current))}
                    className="min-h-28 rounded-3xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
              </div>

              {message && (
                <div className="rounded-3xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                  {message}
                </div>
              )}

              {errorMessage && (
                <div className="rounded-3xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
                  {errorMessage}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="button" disabled={isSaving} className="rounded-full" onClick={saveTool}>
                  {isSaving ? "保存中..." : "保存工具配置"}
                </Button>
                <Button type="button" variant="outline" disabled={isChecking} className="rounded-full" onClick={runHealthCheck}>
                  {isChecking ? "巡检中..." : "执行健康巡检"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
              当前筛选条件下没有可编辑的探测工具。
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
