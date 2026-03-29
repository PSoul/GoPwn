"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { BrainCircuit, Loader2, Minimize2 } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { apiFetch } from "@/lib/api-client"
import type { LlmCallLogRecord, LlmCallRole } from "@/lib/prototype-types"

const roleLabels: Record<LlmCallRole, string> = {
  orchestrator: "编排",
  reviewer: "审阅",
  extractor: "提取",
}

const roleBgColor: Record<LlmCallRole, string> = {
  orchestrator: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  reviewer: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  extractor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
}

const STORAGE_KEY = "ai-chat-widget-expanded"

export function AiChatWidget() {
  const [expanded, setExpanded] = useState(false)
  const [logs, setLogs] = useState<LlmCallLogRecord[]>([])
  const [roleFilter, setRoleFilter] = useState<LlmCallRole | "all">("all")
  const [hasNew, setHasNew] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Restore expanded state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "true") setExpanded(true)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(expanded))
    } catch { /* ignore */ }
  }, [expanded])

  const loadLogs = useCallback(async () => {
    try {
      const res = await apiFetch("/api/llm-logs/recent?limit=50")
      if (res.ok) {
        const payload = await res.json()
        const items = payload.items as LlmCallLogRecord[]
        if (items.length > prevCountRef.current && !expanded) {
          setHasNew(true)
        }
        prevCountRef.current = items.length
        setLogs(items)
      }
    } catch { /* best-effort */ }
  }, [expanded])

  // SSE real-time streaming with polling fallback
  useEffect(() => {
    void loadLogs() // initial load

    let es: EventSource | null = null
    try {
      es = new EventSource("/api/llm-logs/stream")
      es.addEventListener("log", (evt) => {
        const event = JSON.parse(evt.data) as { type: string; log?: LlmCallLogRecord; logId?: string; chunk?: string }
        if (event.type === "created" && event.log) {
          setLogs((prev) => [event.log!, ...prev].slice(0, 50))
          if (!expanded) setHasNew(true)
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
        // SSE failed — fall back to polling
        es?.close()
        es = null
        pollRef.current = setInterval(loadLogs, 3000)
      }
    } catch {
      // EventSource not available — fall back to polling
      pollRef.current = setInterval(loadLogs, 3000)
    }

    return () => {
      es?.close()
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [loadLogs, expanded])

  // Auto-scroll to bottom when expanded and logs update
  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [expanded, logs])

  function handleExpand() {
    setExpanded(true)
    setHasNew(false)
  }

  const filteredLogs = roleFilter === "all"
    ? logs
    : logs.filter((l) => l.role === roleFilter)

  // Reverse to show oldest first (chat style)
  const chatLogs = [...filteredLogs].reverse()

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={handleExpand}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition-transform hover:scale-105 dark:bg-sky-600"
        aria-label="打开 AI 对话日志"
      >
        <BrainCircuit className="h-5 w-5" />
        {hasNew && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full bg-rose-500" />
        )}
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[500px] w-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          <span className="text-sm font-medium text-slate-950 dark:text-white">AI 思考日志</span>
          {logs.some((l) => l.status === "streaming") && (
            <Loader2 className="h-3 w-3 animate-spin text-sky-500" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="最小化"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Role filter tabs */}
      <div className="flex gap-1 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
        {(["all", "orchestrator", "reviewer", "extractor"] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
              roleFilter === key
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
            }`}
            onClick={() => setRoleFilter(key)}
          >
            {key === "all" ? "全部" : roleLabels[key]}
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {chatLogs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            暂无 AI 对话记录
          </div>
        ) : (
          <div className="space-y-3">
            {chatLogs.map((log) => (
              <div key={log.id} className="space-y-1">
                {/* Role label + timestamp */}
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${roleBgColor[log.role]}`}>
                    {roleLabels[log.role]}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(log.createdAt).toLocaleTimeString("zh-CN")}
                  </span>
                  {log.status === "failed" && (
                    <StatusBadge tone="danger">失败</StatusBadge>
                  )}
                </div>

                {/* Bubble */}
                <div className="rounded-xl rounded-tl-sm bg-slate-50 px-3 py-2.5 dark:bg-slate-900">
                  <pre className="whitespace-pre-wrap text-xs leading-5 text-slate-700 dark:text-slate-200">
                    {log.response || (log.status === "streaming" ? "思考中..." : log.error || "暂无输出")}
                    {log.status === "streaming" && (
                      <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-sky-500" />
                    )}
                  </pre>
                </div>

                {/* Metadata */}
                {log.durationMs != null && (
                  <p className="text-[10px] text-slate-400">{log.model} · {(log.durationMs / 1000).toFixed(1)}s</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
