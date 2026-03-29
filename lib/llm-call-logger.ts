import { EventEmitter } from "events"

import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import type { LlmCallLogRecord, LlmCallRole, LlmCallPhase } from "@/lib/prototype-types"

// ── Event bus (survives HMR via globalThis) ─────────────────
const globalForBus = globalThis as unknown as { __llmLogBus?: EventEmitter }
export const llmLogBus = (globalForBus.__llmLogBus ??= new EventEmitter())
llmLogBus.setMaxListeners(100) // support many concurrent SSE clients

export type LlmLogEvent =
  | { type: "created"; log: LlmCallLogRecord }
  | { type: "updated"; logId: string; chunk: string }
  | { type: "completed"; log: LlmCallLogRecord }
  | { type: "failed"; log: LlmCallLogRecord }

function generateId() {
  return `llmlog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function createLlmCallLog(input: {
  projectId: string
  role: LlmCallRole
  phase: LlmCallPhase
  prompt: string
  model: string
  provider: string
}): LlmCallLogRecord {
  const record: LlmCallLogRecord = {
    id: generateId(),
    projectId: input.projectId,
    role: input.role,
    phase: input.phase,
    prompt: input.prompt,
    response: "",
    status: "streaming",
    model: input.model,
    provider: input.provider,
    tokenUsage: null,
    durationMs: null,
    error: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  }

  const store = readPrototypeStore()
  if (!store.llmCallLogs) {
    store.llmCallLogs = []
  }
  store.llmCallLogs.push(record)
  writePrototypeStore(store)

  llmLogBus.emit("log", { type: "created", log: record } satisfies LlmLogEvent)

  return record
}

export function appendLlmCallResponse(logId: string, chunk: string): void {
  const store = readPrototypeStore()
  if (!store.llmCallLogs) return
  const log = store.llmCallLogs.find((l) => l.id === logId)
  if (!log) return
  log.response += chunk
  writePrototypeStore(store)

  llmLogBus.emit("log", { type: "updated", logId, chunk } satisfies LlmLogEvent)
}

export function completeLlmCallLog(
  logId: string,
  result: {
    response?: string
    tokenUsage?: LlmCallLogRecord["tokenUsage"]
    durationMs?: number
  },
): void {
  const store = readPrototypeStore()
  if (!store.llmCallLogs) return
  const log = store.llmCallLogs.find((l) => l.id === logId)
  if (!log) return

  if (result.response !== undefined) {
    log.response = result.response
  }
  log.status = "completed"
  log.tokenUsage = result.tokenUsage ?? null
  log.durationMs = result.durationMs ?? null
  log.completedAt = new Date().toISOString()
  writePrototypeStore(store)

  llmLogBus.emit("log", { type: "completed", log } satisfies LlmLogEvent)
}

export function failLlmCallLog(logId: string, error: string): void {
  const store = readPrototypeStore()
  if (!store.llmCallLogs) return
  const log = store.llmCallLogs.find((l) => l.id === logId)
  if (!log) return

  log.status = "failed"
  log.error = error
  log.completedAt = new Date().toISOString()
  writePrototypeStore(store)

  llmLogBus.emit("log", { type: "failed", log } satisfies LlmLogEvent)
}

export function listLlmCallLogs(
  projectId: string,
  filters?: { role?: LlmCallRole; status?: string; since?: string },
): LlmCallLogRecord[] {
  const store = readPrototypeStore()
  const logs = (store.llmCallLogs ?? []).filter((l) => l.projectId === projectId)

  let filtered = logs
  if (filters?.role) {
    filtered = filtered.filter((l) => l.role === filters.role)
  }
  if (filters?.status) {
    filtered = filtered.filter((l) => l.status === filters.status)
  }
  if (filters?.since) {
    filtered = filtered.filter((l) => l.createdAt >= filters.since!)
  }

  return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getLlmCallLogById(logId: string): LlmCallLogRecord | null {
  const store = readPrototypeStore()
  return (store.llmCallLogs ?? []).find((l) => l.id === logId) ?? null
}

export function listAllRecentLlmCallLogs(limit = 50): LlmCallLogRecord[] {
  const store = readPrototypeStore()
  return (store.llmCallLogs ?? [])
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}
