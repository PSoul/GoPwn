"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { BrainCircuit, ChevronDown, Clock, Loader2, RefreshCw } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { apiFetch } from "@/lib/infra/api-client"
import type { LlmCallLogRecord, LlmCallRole } from "@/lib/prototype-types"

const roleLabels: Record<LlmCallRole, string> = {
  orchestrator: "AI 规划推理",
  reviewer: "结论审阅",
  analyzer: "结果分析",
}

const roleTone: Record<LlmCallRole, "info" | "success" | "warning"> = {
  orchestrator: "info",
  reviewer: "success",
  analyzer: "warning",
}

const statusTone: Record<string, "info" | "success" | "danger" | "neutral"> = {
  streaming: "info",
  completed: "success",
  failed: "danger",
}

/**
 * Try to parse LLM response as a structured plan and render it in a human-readable format.
 * Falls back to raw text if the response is not a recognized JSON structure.
 */
function renderResponseContent(response: string, isStreaming: boolean) {
  if (!response) {
    return isStreaming ? "正在输出中..." : "暂无内容"
  }

  // Try to extract JSON from the response (may be wrapped in markdown code blocks)
  let parsed: unknown = null
  try {
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) ?? response.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
    const jsonStr = jsonMatch ? jsonMatch[1] : response
    parsed = JSON.parse(jsonStr.trim())
  } catch {
    // Not JSON — render as plain text
    return null
  }

  if (!parsed || typeof parsed !== "object") return null

  // Handle plan response with items array
  const obj = parsed as Record<string, unknown>
  const items = Array.isArray(obj.items) ? obj.items : Array.isArray(parsed) ? parsed : null
  const summary = typeof obj.summary === "string" ? obj.summary : null

  if (!items || items.length === 0) return null

  return (
    <div className="space-y-3">
      {summary && (
        <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">{summary}</p>
      )}
      <div className="space-y-2">
        {items.map((item: Record<string, unknown>, idx: number) => {
          const riskColors: Record<string, string> = {
            "低": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
            "中": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
            "高": "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
          }
          const risk = String(item.riskLevel ?? "")
          return (
            <div key={idx} className="rounded-lg border border-slate-200/80 bg-slate-50/50 px-3 py-2 dark:border-slate-700/60 dark:bg-slate-900/30">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {String(item.requestedAction ?? item.action ?? `动作 ${idx + 1}`)}
                </span>
                {!!item.toolName && (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                    {String(item.toolName)}
                  </span>
                )}
                {risk && (
                  <span className={`rounded-full px-2 py-0.5 text-xs ${riskColors[risk] ?? "bg-slate-100 text-slate-600"}`}>
                    {risk}
                  </span>
                )}
              </div>
              {!!item.target && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  目标: {String(item.target)}
                </p>
              )}
              {!!item.rationale && (
                <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                  {String(item.rationale)}
                </p>
              )}
              {!!item.capability && (
                <p className="mt-1 text-xs text-slate-400">
                  能力: {String(item.capability)}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ProjectLlmLogPanel({
  projectId,
  isRunning,
}: {
  projectId: string
  isRunning?: boolean
}) {
  const [logs, setLogs] = useState<LlmCallLogRecord[]>([])
  const [activeRole, setActiveRole] = useState<LlmCallRole | "all">("all")
  const [autoRefresh, setAutoRefresh] = useState(isRunning ?? false)
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set())
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadLogs = useCallback(async () => {
    try {
      const roleParam = activeRole !== "all" ? `?role=${activeRole}` : ""
      const res = await apiFetch(`/api/projects/${projectId}/llm-logs${roleParam}`)
      if (res.ok) {
        const payload = await res.json()
        setLogs(payload.items)
      }
    } catch { /* best-effort */ } finally {
      setIsLoading(false)
    }
  }, [projectId, activeRole])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  // SSE real-time streaming with polling fallback
  const esRef = useRef<EventSource | null>(null)
  useEffect(() => {
    if (!autoRefresh) {
      esRef.current?.close()
      esRef.current = null
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      return
    }

    try {
      const es = new EventSource("/api/llm-logs/stream")
      esRef.current = es
      es.addEventListener("log", (evt) => {
        const event = JSON.parse(evt.data) as { type: string; log?: LlmCallLogRecord; logId?: string; chunk?: string }
        // Only process events for this project
        if (event.log && event.log.projectId !== projectId) return
        if (event.type === "created" && event.log) {
          setLogs((prev) => [event.log!, ...prev])
        } else if (event.type === "updated" && event.logId && event.chunk) {
          setLogs((prev) =>
            prev.map((l) =>
              l.id === event.logId ? { ...l, response: l.response + event.chunk! } : l,
            ),
          )
        } else if ((event.type === "completed" || event.type === "failed") && event.log) {
          setLogs((prev) =>
            prev.map((l) => (l.id === event.log!.id ? event.log! : l)),
          )
        }
      })
      es.onerror = () => {
        es.close()
        esRef.current = null
        // Fall back to polling
        pollRef.current = setInterval(loadLogs, 3000)
      }
    } catch {
      pollRef.current = setInterval(loadLogs, 3000)
    }

    return () => {
      esRef.current?.close()
      esRef.current = null
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [autoRefresh, loadLogs, projectId])

  function togglePrompt(id: string) {
    setExpandedPrompts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleLog(id: string) {
    setExpandedLogs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const roles: Array<{ key: LlmCallRole | "all"; label: string }> = [
    { key: "all", label: "全部" },
    { key: "orchestrator", label: "AI 规划推理" },
    { key: "reviewer", label: "结论审阅" },
    { key: "analyzer", label: "结果分析" },
  ]

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-950 dark:text-white">AI 日志</span>
          <span className="text-xs text-slate-500">{logs.length} 条记录</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            自动刷新
          </label>
          <Button variant="ghost" size="sm" className="rounded-full" onClick={() => void loadLogs()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Role filter tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {roles.map((r) => (
          <button
            key={r.key}
            type="button"
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeRole === r.key
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
            onClick={() => setActiveRole(r.key)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Log entries */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载中...
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
          还没有 AI 调用记录。项目开始运行后，LLM 的规划推理和审阅过程会实时记录到这里。
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const isExpanded = expandedLogs.has(log.id)
            const isPromptExpanded = expandedPrompts.has(log.id)

            return (
              <div
                key={log.id}
                className="rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950"
              >
                {/* Log header */}
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
                  onClick={() => toggleLog(log.id)}
                >
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <StatusBadge tone={roleTone[log.role]}>{roleLabels[log.role]}</StatusBadge>
                    <StatusBadge tone={statusTone[log.status] ?? "neutral"}>
                      {log.status === "streaming" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      {log.status}
                    </StatusBadge>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{log.model}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(log.createdAt).toLocaleString("zh-CN")}</span>
                    {log.durationMs != null && <span>· {(log.durationMs / 1000).toFixed(1)}s</span>}
                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800">
                    {/* Prompt (collapsed by default) */}
                    <div className="border-b border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-5 py-2.5 text-left"
                        onClick={() => togglePrompt(log.id)}
                      >
                        <span className="text-xs font-medium text-slate-500">Prompt</span>
                        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isPromptExpanded ? "rotate-180" : ""}`} />
                      </button>
                      {isPromptExpanded && (
                        <div className="max-h-64 overflow-y-auto px-5 pb-3">
                          <pre className="whitespace-pre-wrap text-xs leading-5 text-slate-600 dark:text-slate-300">
                            {log.prompt}
                          </pre>
                        </div>
                      )}
                    </div>

                    {/* Response (expanded by default, structured when possible) */}
                    <div className="px-5 py-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-medium text-slate-500">Response</p>
                        {log.response && renderResponseContent(log.response, log.status === "streaming") && (
                          <button
                            type="button"
                            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            onClick={() => {
                              setExpandedPrompts((prev) => {
                                const next = new Set(prev)
                                const rawKey = `raw-${log.id}`
                                if (next.has(rawKey)) next.delete(rawKey)
                                else next.add(rawKey)
                                return next
                              })
                            }}
                          >
                            {expandedPrompts.has(`raw-${log.id}`) ? "结构化视图" : "原始内容"}
                          </button>
                        )}
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {(() => {
                          const structured = !expandedPrompts.has(`raw-${log.id}`) && log.response
                            ? renderResponseContent(log.response, log.status === "streaming")
                            : null
                          if (structured) return structured
                          return (
                            <pre className="whitespace-pre-wrap text-xs leading-5 text-slate-700 dark:text-slate-200">
                              {log.response || (log.status === "streaming" ? "正在输出中..." : "暂无内容")}
                              {log.status === "streaming" && (
                                <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-slate-500" />
                              )}
                            </pre>
                          )
                        })()}
                      </div>
                    </div>

                    {/* Metadata footer */}
                    {(log.tokenUsage || log.error) && (
                      <div className="border-t border-slate-100 px-5 py-2.5 dark:border-slate-800">
                        <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                          {log.tokenUsage && (
                            <>
                              <span>Prompt: {log.tokenUsage.promptTokens}</span>
                              <span>Completion: {log.tokenUsage.completionTokens}</span>
                              <span>Total: {log.tokenUsage.totalTokens}</span>
                            </>
                          )}
                          {log.error && (
                            <span className="text-rose-600 dark:text-rose-400">错误: {log.error}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
