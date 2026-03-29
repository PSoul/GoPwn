import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  createLlmCallLog,
  appendLlmCallResponse,
  completeLlmCallLog,
  failLlmCallLog,
  listLlmCallLogs,
  getLlmCallLogById,
  listAllRecentLlmCallLogs,
} from "@/lib/llm-call-logger"

describe("llm-call-logger", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-logger-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
    delete process.env.PROTOTYPE_DATA_DIR
  })

  it("creates a log with streaming status", () => {
    const log = createLlmCallLog({
      projectId: "proj-1",
      role: "orchestrator",
      phase: "planning",
      prompt: "Test prompt",
      model: "gpt-4",
      provider: "openai",
    })

    expect(log.id).toMatch(/^llmlog_/)
    expect(log.status).toBe("streaming")
    expect(log.response).toBe("")
    expect(log.completedAt).toBeNull()
  })

  it("appends response chunks", () => {
    const log = createLlmCallLog({
      projectId: "proj-1",
      role: "orchestrator",
      phase: "planning",
      prompt: "p",
      model: "m",
      provider: "p",
    })

    appendLlmCallResponse(log.id, "chunk1")
    appendLlmCallResponse(log.id, "chunk2")

    const fetched = getLlmCallLogById(log.id)
    expect(fetched?.response).toBe("chunk1chunk2")
  })

  it("completes a log", () => {
    const log = createLlmCallLog({
      projectId: "proj-1",
      role: "reviewer",
      phase: "reviewing",
      prompt: "p",
      model: "m",
      provider: "p",
    })

    completeLlmCallLog(log.id, {
      response: "full response",
      durationMs: 500,
      tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    })

    const fetched = getLlmCallLogById(log.id)
    expect(fetched?.status).toBe("completed")
    expect(fetched?.response).toBe("full response")
    expect(fetched?.durationMs).toBe(500)
    expect(fetched?.tokenUsage?.totalTokens).toBe(30)
    expect(fetched?.completedAt).not.toBeNull()
  })

  it("marks a log as failed", () => {
    const log = createLlmCallLog({
      projectId: "proj-1",
      role: "orchestrator",
      phase: "planning",
      prompt: "p",
      model: "m",
      provider: "p",
    })

    failLlmCallLog(log.id, "timeout")

    const fetched = getLlmCallLogById(log.id)
    expect(fetched?.status).toBe("failed")
    expect(fetched?.error).toBe("timeout")
  })

  it("lists logs filtered by project and role", () => {
    createLlmCallLog({ projectId: "proj-1", role: "orchestrator", phase: "planning", prompt: "1", model: "m", provider: "p" })
    createLlmCallLog({ projectId: "proj-1", role: "reviewer", phase: "reviewing", prompt: "2", model: "m", provider: "p" })
    createLlmCallLog({ projectId: "proj-2", role: "orchestrator", phase: "planning", prompt: "3", model: "m", provider: "p" })

    const all = listLlmCallLogs("proj-1")
    expect(all).toHaveLength(2)

    const orchestratorOnly = listLlmCallLogs("proj-1", { role: "orchestrator" })
    expect(orchestratorOnly).toHaveLength(1)
    expect(orchestratorOnly[0].role).toBe("orchestrator")
  })

  it("returns recent logs across all projects", () => {
    createLlmCallLog({ projectId: "proj-1", role: "orchestrator", phase: "planning", prompt: "1", model: "m", provider: "p" })
    createLlmCallLog({ projectId: "proj-2", role: "reviewer", phase: "reviewing", prompt: "2", model: "m", provider: "p" })

    const recent = listAllRecentLlmCallLogs(10)
    expect(recent).toHaveLength(2)
  })

  it("returns null for non-existent log id", () => {
    expect(getLlmCallLogById("nonexistent")).toBeNull()
  })
})
