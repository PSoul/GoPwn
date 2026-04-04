"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/infra/api-client"

type PipelineLogEntry = {
  id: string
  round: number | null
  jobType: string
  stage: string
  level: string
  message: string
  data: unknown
  duration: number | null
  createdAt: string
}

const LEVEL_COLORS: Record<string, string> = {
  debug: "text-slate-400",
  info: "text-sky-600 dark:text-sky-400",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
}

const LEVEL_OPTIONS = ["debug", "info", "warn", "error"] as const

export function ProjectPipelineLogPanel({ projectId }: { projectId: string }) {
  const [logs, setLogs] = useState<PipelineLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [level, setLevel] = useState<string>("info")
  const [round, setRound] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams({ level, limit: "200" })
    if (round != null) params.set("round", String(round))

    const body = await apiFetch<{ logs: PipelineLogEntry[]; total: number }>(
      `/api/projects/${projectId}/pipeline-logs?${params}`,
    )
    setLogs([...body.logs].reverse()) // API returns desc, we want asc
    setTotal(body.total)
  }, [projectId, level, round])

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 5000)
    return () => clearInterval(interval)
  }, [fetchLogs])

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs, autoScroll])

  const rounds = [...new Set(logs.map((l) => l.round).filter((r): r is number => r != null))].sort()

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2 dark:border-slate-800">
        <span className="text-xs font-medium text-slate-500">轮次:</span>
        <Button
          size="sm"
          variant={round === null ? "default" : "outline"}
          className="h-6 rounded-full px-2 text-xs"
          onClick={() => setRound(null)}
        >
          全部
        </Button>
        {rounds.map((r) => (
          <Button
            key={r}
            size="sm"
            variant={round === r ? "default" : "outline"}
            className="h-6 rounded-full px-2 text-xs"
            onClick={() => setRound(r)}
          >
            R{r}
          </Button>
        ))}

        <span className="ml-4 text-xs font-medium text-slate-500">级别:</span>
        {LEVEL_OPTIONS.map((l) => (
          <Button
            key={l}
            size="sm"
            variant={level === l ? "default" : "outline"}
            className="h-6 rounded-full px-2 text-xs"
            onClick={() => setLevel(l)}
          >
            {l.toUpperCase()}
          </Button>
        ))}

        <label className="ml-auto flex items-center gap-1 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="h-3 w-3"
          />
          自动滚动
        </label>

        <span className="text-xs text-slate-400">{total} 条</span>
      </div>

      <div className="max-h-[500px] overflow-x-auto overflow-y-auto px-4 py-2 font-mono text-xs">
        {logs.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400" role="status">暂无日志</p>
        )}
        {logs.map((entry) => {
          const time = new Date(entry.createdAt).toLocaleTimeString("zh-CN", { hour12: false })
          const isExpanded = expandedId === entry.id
          const isError = entry.level === "error"

          return (
            <div
              key={entry.id}
              className={`border-b border-slate-50 py-1 dark:border-slate-900 ${isError ? "bg-red-50/50 dark:bg-red-950/20" : ""}`}
            >
              <button
                type="button"
                className="flex w-full cursor-pointer items-start gap-2 text-left"
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
              >
                <span className="shrink-0 text-slate-400">{time}</span>
                <span className="w-12 shrink-0 text-slate-500">R{entry.round ?? "-"}</span>
                <span className="w-28 shrink-0 truncate text-slate-500">{entry.jobType}</span>
                <span className="w-24 shrink-0 truncate text-slate-400">{entry.stage}</span>
                <span className={`w-10 shrink-0 font-semibold ${LEVEL_COLORS[entry.level] ?? ""}`}>
                  {entry.level.toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
                  {entry.message}
                  {entry.duration != null && (
                    <span className="ml-1 text-slate-400">[{(entry.duration / 1000).toFixed(1)}s]</span>
                  )}
                </span>
              </button>
              {isExpanded && entry.data != null && (
                <pre className="ml-10 mt-1 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  {JSON.stringify(entry.data as Record<string, unknown>, null, 2)}
                </pre>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
