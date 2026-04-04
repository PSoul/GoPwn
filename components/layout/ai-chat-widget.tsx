"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { BrainCircuit, Loader2, Minimize2 } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { apiFetch } from "@/lib/infra/api-client"
import type { LlmCallLog } from "@/lib/generated/prisma"

type LlmRole = "orchestrator" | "reviewer" | "analyzer"

const roleLabels: Record<LlmRole, string> = {
  orchestrator: "规划",
  reviewer: "审阅",
  analyzer: "分析",
}

const roleBgColor: Record<LlmRole, string> = {
  orchestrator: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  reviewer: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  analyzer: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
}

const STORAGE_KEY = "ai-chat-widget-expanded"

/** Render LLM plan JSON as a compact readable summary */
function renderChatBubbleContent(response: string): React.ReactNode | null {
  if (!response) return null
  try {
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) ?? response.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
    const jsonStr = jsonMatch ? jsonMatch[1] : response
    const parsed = JSON.parse(jsonStr.trim()) as Record<string, unknown>
    const rawItems = Array.isArray(parsed.items) ? parsed.items : Array.isArray(parsed) ? parsed : null
    const summary = typeof parsed.summary === "string" ? parsed.summary : null
    if (!rawItems || rawItems.length === 0) return null
    const items = rawItems as Array<Record<string, string>>

    return (
      <div className="space-y-1.5 text-xs leading-5 text-slate-700 dark:text-slate-200">
        {summary && <p>{summary}</p>}
        {items.map((item: Record<string, unknown>, idx: number) => (
          <div key={idx} className="flex items-start gap-1.5">
            <span className="mt-0.5 shrink-0 text-slate-400">{idx + 1}.</span>
            <span>
              <span className="font-medium">{String(item.requestedAction ?? item.action ?? "")}</span>
              {!!item.toolName && <span className="ml-1 text-sky-600 dark:text-sky-400">[{String(item.toolName)}]</span>}
              {!!item.target && <span className="ml-1 text-slate-400">→ {String(item.target)}</span>}
            </span>
          </div>
        ))}
      </div>
    )
  } catch {
    return null
  }
}

export function AiChatWidget() {
  const [expanded, setExpanded] = useState(false)
  const [logs, setLogs] = useState<LlmCallLog[]>([])
  const [roleFilter, setRoleFilter] = useState<LlmRole | "all">("all")
  const [hasNew, setHasNew] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const pathname = usePathname()
  const currentProjectId = pathname?.match(/\/projects\/([^/]+)/)?.[1] ?? null

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
      const params = new URLSearchParams({ limit: "50" })
      if (currentProjectId) params.set("projectId", currentProjectId)
      const payload = await apiFetch<{ items: LlmCallLog[] }>(`/api/llm-logs/recent?${params}`)
      if (payload.items) {
        if (payload.items.length > prevCountRef.current && !expanded) {
          setHasNew(true)
        }
        prevCountRef.current = payload.items.length
        setLogs(payload.items)
      }
    } catch { /* best-effort */ }
  }, [expanded, currentProjectId])

  useEffect(() => {
    void loadLogs()
    pollRef.current = setInterval(loadLogs, 5000)
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [loadLogs])

  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [expanded, logs])

  function handleExpand() {
    setExpanded(true)
    setHasNew(false)
  }

  const filteredLogs = logs.filter((l) => {
    if (roleFilter !== "all" && l.role !== roleFilter) return false
    return true
  })

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
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          <span className="text-sm font-medium text-slate-950 dark:text-white">AI 思考日志</span>
          {logs.some((l) => l.status === "streaming") && (
            <Loader2 className="h-3 w-3 animate-spin text-sky-500" />
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="最小化"
        >
          <Minimize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex gap-1 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
        {(["all", "orchestrator", "reviewer", "analyzer"] as const).map((key) => (
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {chatLogs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            暂无 AI 对话记录
          </div>
        ) : (
          <div className="space-y-3">
            {chatLogs.map((log) => (
              <div key={log.id} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${roleBgColor[log.role as LlmRole] ?? "bg-slate-100 text-slate-600"}`}>
                    {roleLabels[log.role as LlmRole] ?? log.role}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(log.createdAt).toLocaleTimeString("zh-CN")}
                  </span>
                  {log.status === "failed" && (
                    <StatusBadge tone="danger">失败</StatusBadge>
                  )}
                </div>

                <div className="rounded-xl rounded-tl-sm bg-slate-50 px-3 py-2.5 dark:bg-slate-900">
                  {(() => {
                    const structured = log.response ? renderChatBubbleContent(log.response) : null
                    if (structured) return structured
                    return (
                      <pre className="whitespace-pre-wrap text-xs leading-5 text-slate-700 dark:text-slate-200">
                        {log.response || (log.status === "streaming" ? "思考中..." : log.error || "暂无输出")}
                        {log.status === "streaming" && (
                          <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-sky-500" />
                        )}
                      </pre>
                    )
                  })()}
                </div>

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
