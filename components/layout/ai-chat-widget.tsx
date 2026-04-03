"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { BrainCircuit, ChevronDown, Loader2, Minimize2 } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { apiFetch } from "@/lib/infra/api-client"
import type { LlmCallLogRecord, LlmCallRole } from "@/lib/prototype-types"

const roleLabels: Record<LlmCallRole, string> = {
  orchestrator: "规划",
  reviewer: "审阅",
  analyzer: "分析",
}

const roleBgColor: Record<LlmCallRole, string> = {
  orchestrator: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  reviewer: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  analyzer: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
}

const STORAGE_KEY = "ai-chat-widget-expanded"

/** Render LLM plan JSON as a compact readable summary for the chat widget */
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
  const [logs, setLogs] = useState<LlmCallLogRecord[]>([])
  const [roleFilter, setRoleFilter] = useState<LlmCallRole | "all">("all")
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const [hasNew, setHasNew] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const userManualFilterRef = useRef(false)

  // Detect current project from URL
  const pathname = usePathname()
  const currentProjectId = pathname?.match(/\/projects\/([^/]+)/)?.[1] ?? null

  // Auto-switch to current project when navigating to a project page
  useEffect(() => {
    if (currentProjectId && !userManualFilterRef.current) {
      setProjectFilter(currentProjectId)
    } else if (!currentProjectId && !userManualFilterRef.current) {
      setProjectFilter("all")
    }
  }, [currentProjectId])

  // Build unique project list from loaded logs
  const projectOptions = useMemo(() => {
    const map = new Map<string, string>()
    logs.forEach((l) => {
      if (l.projectName) map.set(l.projectId, l.projectName)
    })
    return Array.from(map.entries()) // [[id, name], ...]
  }, [logs])

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
          if (!expanded) {
            setExpanded(true)
            setHasNew(false)
          }
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

  function handleProjectFilterChange(value: string) {
    userManualFilterRef.current = value !== "all"
    setProjectFilter(value)
    setProjectDropdownOpen(false)
  }

  // Apply both role and project filters
  const filteredLogs = logs.filter((l) => {
    if (roleFilter !== "all" && l.role !== roleFilter) return false
    if (projectFilter !== "all" && l.projectId !== projectFilter) return false
    return true
  })

  // Reverse to show oldest first (chat style)
  const chatLogs = [...filteredLogs].reverse()

  // Get active project filter label
  const activeProjectLabel = projectFilter === "all"
    ? "全部项目"
    : projectOptions.find(([id]) => id === projectFilter)?.[1] ?? "当前项目"

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

        {/* Project filter dropdown */}
        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
            className="flex items-center gap-0.5 rounded-full bg-violet-100 px-2 py-1 text-[10px] font-medium text-violet-700 transition-colors hover:bg-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:hover:bg-violet-900"
            aria-label="筛选项目"
          >
            <span className="max-w-[72px] truncate">{activeProjectLabel}</span>
            <ChevronDown className="h-2.5 w-2.5 shrink-0" />
          </button>
          {projectDropdownOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                className={`block w-full px-3 py-1.5 text-left text-[11px] hover:bg-slate-50 dark:hover:bg-slate-800 ${projectFilter === "all" ? "font-semibold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}
                onClick={() => handleProjectFilterChange("all")}
              >
                全部项目
              </button>
              {currentProjectId && (
                <button
                  type="button"
                  className={`block w-full px-3 py-1.5 text-left text-[11px] hover:bg-slate-50 dark:hover:bg-slate-800 ${projectFilter === currentProjectId ? "font-semibold text-violet-700 dark:text-violet-300" : "text-slate-600 dark:text-slate-300"}`}
                  onClick={() => handleProjectFilterChange(currentProjectId)}
                >
                  当前项目
                </button>
              )}
              {projectOptions.length > 0 && (
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
              )}
              {projectOptions.map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  className={`block w-full truncate px-3 py-1.5 text-left text-[11px] hover:bg-slate-50 dark:hover:bg-slate-800 ${projectFilter === id ? "font-semibold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}
                  onClick={() => handleProjectFilterChange(id)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
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
                {/* Role label + project badge + timestamp */}
                <div className="flex items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${roleBgColor[log.role]}`}>
                    {roleLabels[log.role]}
                  </span>
                  {log.projectName && projectFilter === "all" && (
                    <span className="max-w-[100px] truncate rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                      {log.projectName}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">
                    {new Date(log.createdAt).toLocaleTimeString("zh-CN")}
                  </span>
                  {log.status === "failed" && (
                    <StatusBadge tone="danger">失败</StatusBadge>
                  )}
                </div>

                {/* Bubble — structured view for plan JSON, raw for everything else */}
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
