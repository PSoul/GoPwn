"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { BrainCircuit, ChevronDown, Clock, Loader2, RefreshCw } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { apiFetch } from "@/lib/api-client"
import type { LlmCallLogRecord, LlmCallRole } from "@/lib/prototype-types"

const roleLabels: Record<LlmCallRole, string> = {
  orchestrator: "编排推理",
  reviewer: "结论审阅",
  extractor: "数据提取",
}

const roleTone: Record<LlmCallRole, "info" | "success" | "warning"> = {
  orchestrator: "info",
  reviewer: "success",
  extractor: "warning",
}

const statusTone: Record<string, "info" | "success" | "danger" | "neutral"> = {
  streaming: "info",
  completed: "success",
  failed: "danger",
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

  useEffect(() => {
    if (autoRefresh) {
      pollRef.current = setInterval(loadLogs, 3000)
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [autoRefresh, loadLogs])

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
    { key: "orchestrator", label: "编排推理" },
    { key: "reviewer", label: "结论审阅" },
    { key: "extractor", label: "数据提取" },
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
          还没有 AI 调用记录。项目开始运行后，LLM 的编排推理和审阅过程会实时记录到这里。
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

                    {/* Response (expanded by default) */}
                    <div className="px-5 py-3">
                      <p className="mb-2 text-xs font-medium text-slate-500">Response</p>
                      <div className="max-h-96 overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-xs leading-5 text-slate-700 dark:text-slate-200">
                          {log.response || (log.status === "streaming" ? "正在输出中..." : "暂无内容")}
                          {log.status === "streaming" && (
                            <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-slate-500" />
                          )}
                        </pre>
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
