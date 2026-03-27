"use client"

import { useEffect, useState } from "react"
import { Activity, PlugZap, ShieldCheck, ShieldOff } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { McpToolTable } from "@/components/settings/mcp-tool-table"
import type {
  McpBoundaryRule,
  McpCapabilityRecord,
  McpRegistrationField,
  McpServerContractSummaryRecord,
  McpServerInvocationRecord,
  McpServerRecord,
  McpToolContractSummaryRecord,
  McpToolRecord,
} from "@/lib/prototype-types"

const statusChoices: McpToolRecord["status"][] = ["启用", "禁用", "异常"]
const registrationTemplate = JSON.stringify(
  {
    serverName: "web-surface-stdio",
    version: "1.0.0",
    transport: "stdio",
    command: "node",
    args: ["scripts/mcp/web-surface-server.mjs"],
    endpoint: "stdio://web-surface-stdio",
    enabled: true,
    notes: "真实 Web 页面探测 MCP server",
    tools: [
      {
        toolName: "web-surface-map",
        title: "Web 页面探测",
        description: "补采页面入口与响应特征。",
        version: "1.0.0",
        capability: "Web 页面探测类",
        boundary: "外部目标交互",
        riskLevel: "中",
        requiresApproval: false,
        resultMappings: ["webEntries", "evidence"],
        inputSchema: {
          type: "object",
          properties: {
            targetUrl: {
              type: "string",
            },
          },
          required: ["targetUrl"],
          additionalProperties: false,
        },
        outputSchema: {
          type: "object",
          properties: {
            webEntries: {
              type: "array",
            },
          },
          additionalProperties: true,
        },
        defaultConcurrency: "1",
        rateLimit: "10 req/min",
        timeout: "15s",
        retry: "1 次",
        owner: "真实 Web recon",
      },
    ],
  },
  null,
  2,
)

export function McpGatewayClient({
  initialTools,
  initialServers,
  initialInvocations,
  capabilities,
  boundaryRules,
  registrationFields,
  initialServerContracts,
  initialToolContracts,
}: {
  initialTools: McpToolRecord[]
  initialServers: McpServerRecord[]
  initialInvocations: McpServerInvocationRecord[]
  capabilities: McpCapabilityRecord[]
  boundaryRules: McpBoundaryRule[]
  registrationFields: McpRegistrationField[]
  initialServerContracts: McpServerContractSummaryRecord[]
  initialToolContracts: McpToolContractSummaryRecord[]
}) {
  const [tools, setTools] = useState(initialTools)
  const [servers, setServers] = useState(initialServers)
  const [serverContracts, setServerContracts] = useState(initialServerContracts)
  const [toolContracts, setToolContracts] = useState(initialToolContracts)
  const [query, setQuery] = useState("")
  const [selectedToolId, setSelectedToolId] = useState(initialTools[0]?.id ?? "")
  const [draft, setDraft] = useState<McpToolRecord | null>(initialTools[0] ? { ...initialTools[0] } : null)
  const [isSaving, setIsSaving] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [registrationDraft, setRegistrationDraft] = useState(registrationTemplate)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const filteredTools = tools.filter((tool) =>
    [tool.toolName, tool.capability, tool.category, tool.description].join(" ").toLowerCase().includes(query.trim().toLowerCase()),
  )
  const enabledCount = tools.filter((tool) => tool.status === "启用").length
  const abnormalCount = tools.filter((tool) => tool.status === "异常").length
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

    if (!nextTool) {
      return
    }

    setSelectedToolId(nextTool.id)
    setDraft({ ...nextTool })
    setMessage(null)
    setErrorMessage(null)
  }

  async function saveTool() {
    if (!draft) {
      return
    }

    setIsSaving(true)
    setMessage(null)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/settings/mcp-tools/${draft.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          status: draft.status,
          defaultConcurrency: draft.defaultConcurrency,
          rateLimit: draft.rateLimit,
          timeout: draft.timeout,
          retry: draft.retry,
          notes: draft.notes,
        }),
      })
      const payload = (await response.json()) as { tool?: McpToolRecord; error?: string }

      if (!response.ok || !payload.tool) {
        setErrorMessage(payload.error ?? "MCP 工具配置保存失败，请稍后再试。")
        return
      }

      setTools((current) => current.map((tool) => (tool.id === payload.tool?.id ? payload.tool : tool)))
      setDraft(payload.tool)
      setMessage(`MCP 工具 ${payload.tool.toolName} 已保存。`)
    } catch {
      setErrorMessage("MCP 工具配置保存失败，请稍后再试。")
    } finally {
      setIsSaving(false)
    }
  }

  async function runHealthCheck() {
    if (!draft) {
      return
    }

    setIsChecking(true)
    setMessage(null)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/settings/mcp-tools/${draft.id}/health-check`, {
        method: "POST",
      })
      const payload = (await response.json()) as { tool?: McpToolRecord; error?: string }

      if (!response.ok || !payload.tool) {
        setErrorMessage(payload.error ?? "MCP 健康巡检失败，请稍后再试。")
        return
      }

      setTools((current) => current.map((tool) => (tool.id === payload.tool?.id ? payload.tool : tool)))
      setDraft(payload.tool)
      setMessage(`已完成 ${payload.tool.toolName} 的健康巡检。`)
    } catch {
      setErrorMessage("MCP 健康巡检失败，请稍后再试。")
    } finally {
      setIsChecking(false)
    }
  }

  async function registerServer() {
    setIsRegistering(true)
    setMessage(null)
    setErrorMessage(null)

    try {
      JSON.parse(registrationDraft)
    } catch {
      setErrorMessage("MCP 注册 JSON 不是合法 JSON，请先修正格式。")
      setIsRegistering(false)
      return
    }

    try {
      const response = await fetch("/api/settings/mcp-servers/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: registrationDraft,
      })
      const payload = (await response.json()) as {
        server?: McpServerRecord
        serverContract?: McpServerContractSummaryRecord
        toolContracts?: McpToolContractSummaryRecord[]
        toolRecords?: McpToolRecord[]
        error?: string
      }

      if (!response.ok || !payload.server || !payload.serverContract || !payload.toolContracts || !payload.toolRecords) {
        setErrorMessage(payload.error ?? "MCP 注册失败，请稍后再试。")
        return
      }

      setServers((current) => [payload.server!, ...current.filter((server) => server.id !== payload.server!.id)])
      setServerContracts((current) => [
        payload.serverContract!,
        ...current.filter((contract) => contract.serverId !== payload.serverContract!.serverId),
      ])
      setToolContracts((current) => [
        ...payload.toolContracts!,
        ...current.filter(
          (contract) => !payload.toolContracts?.some((nextContract) => nextContract.serverId === contract.serverId && nextContract.toolName === contract.toolName),
        ),
      ])
      setTools((current) => [
        ...payload.toolRecords!,
        ...current.filter(
          (tool) => !payload.toolRecords?.some((nextTool) => nextTool.toolName === tool.toolName || nextTool.id === tool.id),
        ),
      ])
      if (!selectedToolId && payload.toolRecords[0]) {
        setSelectedToolId(payload.toolRecords[0].id)
        setDraft({ ...payload.toolRecords[0] })
      }
      setMessage(`MCP server ${payload.server.serverName} 已完成契约校验并注册。`)
    } catch {
      setErrorMessage("MCP 注册失败，请稍后再试。")
    } finally {
      setIsRegistering(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "已注册工具", value: String(tools.length), note: "作为网关可挑选的真实接入位", icon: PlugZap },
          { label: "已覆盖能力族", value: String(coveredCapabilityCount), note: "按能力而不是按具体工具名调度", icon: Activity },
          { label: "启用状态", value: String(enabledCount), note: "当前允许进入调度候选池的工具", icon: ShieldCheck },
          { label: "异常 / 禁用", value: String(tools.length - enabledCount), note: `${abnormalCount} 个异常，需要先巡检再放量`, icon: ShieldOff },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_12px_40px_-32px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-950/70"
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

      <SectionCard
        title="MCP 契约注册"
        description="这里输入新的 MCP server 注册 JSON。平台会按合同文档做字段校验，通过后才会把 server、工具契约和可调度工具一起写入真实存储。"
      >
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <Textarea
              aria-label="MCP 注册 JSON"
              value={registrationDraft}
              onChange={(event) => setRegistrationDraft(event.target.value)}
              className="min-h-[360px] rounded-3xl border-slate-200 bg-slate-50 font-mono text-xs leading-6 dark:border-slate-800 dark:bg-slate-900"
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" disabled={isRegistering} className="rounded-full" onClick={registerServer}>
                {isRegistering ? "注册中..." : "校验并注册 MCP"}
              </Button>
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setRegistrationDraft(registrationTemplate)}>
                还原模板
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">当前契约快照</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{serverContracts.length}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                已验证 server 契约 {serverContracts.length} 个，工具契约 {toolContracts.length} 个。
              </p>
            </div>

            <div className="space-y-3">
              {serverContracts.length > 0 ? (
                serverContracts.map((contract) => (
                  <div
                    key={contract.serverId}
                    className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950 dark:text-white">{contract.serverName}</p>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          {contract.transport} · v{contract.version}
                        </p>
                      </div>
                      <StatusBadge tone={contract.enabled ? "success" : "neutral"}>{contract.enabled ? "已启用" : "已停用"}</StatusBadge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">绑定工具：{contract.toolNames.join("、")}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{contract.updatedAt}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                  还没有经过合同校验的 MCP server。
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <SectionCard title="已注册 MCP 工具" description="工具是具体接入位，平台调度时真正依赖的是能力族和注册契约。">
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

        <SectionCard title="工具详情与默认策略" description="这里先落地 MCP 注册骨架：谁提供能力、怎么接入、默认边界和限制是什么。">
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
                    <StatusBadge tone={draft.status === "异常" ? "danger" : draft.status === "启用" ? "success" : "neutral"}>
                      {draft.status}
                    </StatusBadge>
                    <StatusBadge tone={draft.riskLevel === "高" ? "danger" : draft.riskLevel === "中" ? "warning" : "success"}>
                      风险 {draft.riskLevel}
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
                    {draft.requiresApproval ? "默认必须审批" : "默认自动执行"}
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-xs text-slate-500 dark:text-slate-400">输入模式</p>
                  <p className="mt-2 text-sm font-medium text-slate-950 dark:text-white">{draft.inputMode}</p>
                </div>
                <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-xs text-slate-500 dark:text-slate-400">输出模式</p>
                  <p className="mt-2 text-sm font-medium text-slate-950 dark:text-white">{draft.outputMode}</p>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    aria-label="默认并发"
                    value={draft.defaultConcurrency}
                    onChange={(event) => setDraft((current) => (current ? { ...current, defaultConcurrency: event.target.value } : current))}
                    className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  />
                  <Input
                    aria-label="默认速率"
                    value={draft.rateLimit}
                    onChange={(event) => setDraft((current) => (current ? { ...current, rateLimit: event.target.value } : current))}
                    className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  />
                  <Input
                    aria-label="默认超时"
                    value={draft.timeout}
                    onChange={(event) => setDraft((current) => (current ? { ...current, timeout: event.target.value } : current))}
                    className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  />
                  <Input
                    aria-label="默认重试"
                    value={draft.retry}
                    onChange={(event) => setDraft((current) => (current ? { ...current, retry: event.target.value } : current))}
                    className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  />
                </div>

                <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-xs text-slate-500 dark:text-slate-400">接入端点</p>
                  <p className="mt-2 text-sm font-medium text-slate-950 dark:text-white">{draft.endpoint}</p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">责任方：{draft.owner}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {statusChoices.map((status) => (
                    <Button
                      key={status}
                      type="button"
                      variant={draft.status === status ? "default" : "outline"}
                      size="sm"
                      className="rounded-full"
                      onClick={() => setDraft((current) => (current ? { ...current, status } : current))}
                    >
                      {status}
                    </Button>
                  ))}
                </div>

                <Textarea
                  aria-label="MCP 工具备注"
                  value={draft.notes}
                  onChange={(event) => setDraft((current) => (current ? { ...current, notes: event.target.value } : current))}
                  className="min-h-28 rounded-3xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                />
              </div>

              {message ? (
                <div className="rounded-3xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                  {message}
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-3xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
                  {errorMessage}
                </div>
              ) : null}

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
              当前筛选条件下没有可编辑的 MCP 工具。
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="已连接 MCP 服务器"
        description="这里展示真实 MCP server 注册表和最近一次实际调用，让我们能快速确认哪些能力已经从原型接线升级到了真实 stdio 链路。"
      >
        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">已接入 server</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{connectedServerCount}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">真实 MCP server 会优先承接对应能力族，没有命中时才回退到本地原型 connector。</p>
            </div>

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
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{server.endpoint}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge tone={server.enabled ? "success" : "neutral"}>{server.enabled ? "已启用" : "已停用"}</StatusBadge>
                      <StatusBadge tone={server.status === "异常" ? "danger" : server.status === "已连接" ? "success" : "neutral"}>
                        {server.status}
                      </StatusBadge>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">绑定工具：{server.toolBindings.join("、")}</p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    最近心跳：{server.lastSeen} · {server.notes}
                  </p>
                </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                  当前还没有注册任何 MCP server。
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {initialInvocations.length > 0 ? (
              initialInvocations.map((invocation) => (
                <div
                  key={invocation.id}
                  className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">{invocation.toolName}</p>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{invocation.target}</p>
                    </div>
                    <StatusBadge
                      tone={
                        invocation.status === "succeeded"
                          ? "success"
                          : invocation.status === "timeout"
                            ? "warning"
                            : invocation.status === "cancelled"
                              ? "neutral"
                              : "danger"
                      }
                    >
                      {invocation.status}
                    </StatusBadge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{invocation.summary}</p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {invocation.createdAt} · {invocation.durationMs} ms
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                真实 MCP server 已注册，但还没有产生调用记录。
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
        <SectionCard title="MCP 能力族" description="平台调度时优先看能力契约，工具只是实现承载位。">
          <div className="grid gap-4 md:grid-cols-2">
            {capabilities.map((capability) => (
              <div
                key={capability.id}
                className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">{capability.name}</p>
                  <StatusBadge tone={capability.defaultRiskLevel === "高" ? "danger" : capability.defaultRiskLevel === "中" ? "warning" : "success"}>
                    风险 {capability.defaultRiskLevel}
                  </StatusBadge>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{capability.description}</p>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{capability.defaultApprovalRule}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">边界：{capability.boundary}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  已接入：{capability.connectedTools.length > 0 ? capability.connectedTools.join("、") : "待接入"}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="调用边界规则" description="先把“哪些动作必须经过 MCP”定义清楚，后面逐个接入工具才不会跑偏。">
            <div className="space-y-4">
              {boundaryRules.map((rule) => (
                <div
                  key={rule.title}
                  className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">{rule.title}</p>
                    <StatusBadge tone={rule.type === "外部目标交互" ? "warning" : "info"}>{rule.type}</StatusBadge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{rule.description}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="接入规范清单" description="后续新增 MCP 时，先满足这些字段，再决定是否允许进入调度网关。">
            <div className="space-y-3">
              {registrationFields.map((field) => (
                <div
                  key={field.label}
                  className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70"
                >
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">{field.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{field.description}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
