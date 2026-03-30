import { EventEmitter } from "events"

import { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { toLlmCallLogRecord } from "@/lib/prisma-transforms"
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

export async function createLlmCallLog(input: {
  projectId: string
  role: LlmCallRole
  phase: LlmCallPhase
  prompt: string
  model: string
  provider: string
}): Promise<LlmCallLogRecord> {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { name: true },
  })
  const projectName = project?.name ?? "未知项目"

  const dbRow = await prisma.llmCallLog.create({
    data: {
      projectId: input.projectId,
      role: input.role,
      phase: input.phase,
      prompt: input.prompt,
      response: "",
      status: "streaming",
      model: input.model,
      provider: input.provider,
      tokenUsage: Prisma.DbNull,
      durationMs: null,
      error: null,
    },
    include: { project: { select: { name: true } } },
  })

  const record: LlmCallLogRecord = {
    ...toLlmCallLogRecord(dbRow),
    projectName,
  }

  llmLogBus.emit("log", { type: "created", log: record } satisfies LlmLogEvent)

  return record
}

export async function appendLlmCallResponse(logId: string, chunk: string): Promise<void> {
  const existing = await prisma.llmCallLog.findUnique({ where: { id: logId } })
  if (!existing) return

  await prisma.llmCallLog.update({
    where: { id: logId },
    data: { response: existing.response + chunk },
  })

  llmLogBus.emit("log", { type: "updated", logId, chunk } satisfies LlmLogEvent)
}

export async function completeLlmCallLog(
  logId: string,
  result: {
    response?: string
    tokenUsage?: LlmCallLogRecord["tokenUsage"]
    durationMs?: number
  },
): Promise<void> {
  const existing = await prisma.llmCallLog.findUnique({ where: { id: logId } })
  if (!existing) return

  const dbRow = await prisma.llmCallLog.update({
    where: { id: logId },
    data: {
      ...(result.response !== undefined ? { response: result.response } : {}),
      status: "completed",
      tokenUsage: (result.tokenUsage ?? null) as unknown as import("@/lib/generated/prisma/client").Prisma.InputJsonValue,
      durationMs: result.durationMs ?? null,
      completedAt: new Date(),
    },
    include: { project: { select: { name: true } } },
  })

  llmLogBus.emit("log", { type: "completed", log: toLlmCallLogRecord(dbRow) } satisfies LlmLogEvent)
}

export async function failLlmCallLog(logId: string, error: string): Promise<void> {
  const existing = await prisma.llmCallLog.findUnique({ where: { id: logId } })
  if (!existing) return

  const dbRow = await prisma.llmCallLog.update({
    where: { id: logId },
    data: {
      status: "failed",
      error,
      completedAt: new Date(),
    },
    include: { project: { select: { name: true } } },
  })

  llmLogBus.emit("log", { type: "failed", log: toLlmCallLogRecord(dbRow) } satisfies LlmLogEvent)
}

export async function listLlmCallLogs(
  projectId: string,
  filters?: { role?: LlmCallRole; status?: string; since?: string },
): Promise<LlmCallLogRecord[]> {
  const rows = await prisma.llmCallLog.findMany({
    where: {
      projectId,
      ...(filters?.role ? { role: filters.role } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.since ? { createdAt: { gte: new Date(filters.since) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { project: { select: { name: true } } },
  })

  return rows.map(toLlmCallLogRecord)
}

export async function getLlmCallLogById(logId: string): Promise<LlmCallLogRecord | null> {
  const row = await prisma.llmCallLog.findUnique({
    where: { id: logId },
    include: { project: { select: { name: true } } },
  })
  return row ? toLlmCallLogRecord(row) : null
}

export async function listAllRecentLlmCallLogs(limit = 50): Promise<LlmCallLogRecord[]> {
  const rows = await prisma.llmCallLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { project: { select: { name: true } } },
  })
  return rows.map(toLlmCallLogRecord)
}
