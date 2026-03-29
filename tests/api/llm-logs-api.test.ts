import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GET as getLlmLogs } from "@/app/api/projects/[projectId]/llm-logs/route"
import { GET as getLlmLogDetail } from "@/app/api/projects/[projectId]/llm-logs/[logId]/route"
import { GET as getRecentLlmLogs } from "@/app/api/llm-logs/recent/route"
import { createLlmCallLog, completeLlmCallLog, failLlmCallLog } from "@/lib/llm-call-logger"

const buildProjectContext = (projectId: string) => ({
  params: Promise.resolve({ projectId }),
})

const buildLogContext = (projectId: string, logId: string) => ({
  params: Promise.resolve({ projectId, logId }),
})

describe("llm call logs api", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-llm-logs-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
    delete process.env.PROTOTYPE_DATA_DIR
  })

  it("returns empty list when no logs exist", async () => {
    const request = new Request("http://localhost/api/projects/proj-1/llm-logs")
    const response = await getLlmLogs(request, buildProjectContext("proj-1"))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.items).toEqual([])
    expect(payload.total).toBe(0)
  })

  it("creates and lists llm call logs", async () => {
    const log = createLlmCallLog({
      projectId: "proj-1",
      role: "orchestrator",
      phase: "planning",
      prompt: "Test prompt",
      model: "gpt-4",
      provider: "openai-compatible",
    })

    completeLlmCallLog(log.id, {
      response: "Test response",
      durationMs: 1234,
    })

    const request = new Request("http://localhost/api/projects/proj-1/llm-logs")
    const response = await getLlmLogs(request, buildProjectContext("proj-1"))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.total).toBe(1)
    expect(payload.items[0].role).toBe("orchestrator")
    expect(payload.items[0].status).toBe("completed")
    expect(payload.items[0].response).toBe("Test response")
    expect(payload.items[0].durationMs).toBe(1234)
  })

  it("filters by role", async () => {
    createLlmCallLog({
      projectId: "proj-1",
      role: "orchestrator",
      phase: "planning",
      prompt: "Plan prompt",
      model: "gpt-4",
      provider: "openai-compatible",
    })
    createLlmCallLog({
      projectId: "proj-1",
      role: "reviewer",
      phase: "reviewing",
      prompt: "Review prompt",
      model: "gpt-4",
      provider: "openai-compatible",
    })

    const request = new Request("http://localhost/api/projects/proj-1/llm-logs?role=reviewer")
    const response = await getLlmLogs(request, buildProjectContext("proj-1"))
    const payload = await response.json()

    expect(payload.total).toBe(1)
    expect(payload.items[0].role).toBe("reviewer")
  })

  it("returns single log detail", async () => {
    const log = createLlmCallLog({
      projectId: "proj-1",
      role: "orchestrator",
      phase: "planning",
      prompt: "Detail prompt",
      model: "gpt-4",
      provider: "openai-compatible",
    })

    const request = new Request(`http://localhost/api/projects/proj-1/llm-logs/${log.id}`)
    const response = await getLlmLogDetail(request, buildLogContext("proj-1", log.id))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.id).toBe(log.id)
    expect(payload.prompt).toBe("Detail prompt")
  })

  it("returns 404 for missing log", async () => {
    const request = new Request("http://localhost/api/projects/proj-1/llm-logs/nonexistent")
    const response = await getLlmLogDetail(request, buildLogContext("proj-1", "nonexistent"))

    expect(response.status).toBe(404)
  })

  it("records failed logs correctly", async () => {
    const log = createLlmCallLog({
      projectId: "proj-1",
      role: "orchestrator",
      phase: "planning",
      prompt: "Fail prompt",
      model: "gpt-4",
      provider: "openai-compatible",
    })

    failLlmCallLog(log.id, "Connection timeout")

    const request = new Request("http://localhost/api/projects/proj-1/llm-logs")
    const response = await getLlmLogs(request, buildProjectContext("proj-1"))
    const payload = await response.json()

    expect(payload.items[0].status).toBe("failed")
    expect(payload.items[0].error).toBe("Connection timeout")
  })

  it("returns recent logs across all projects", async () => {
    createLlmCallLog({
      projectId: "proj-1",
      role: "orchestrator",
      phase: "planning",
      prompt: "P1",
      model: "gpt-4",
      provider: "openai-compatible",
    })
    createLlmCallLog({
      projectId: "proj-2",
      role: "reviewer",
      phase: "reviewing",
      prompt: "P2",
      model: "gpt-4",
      provider: "openai-compatible",
    })

    const request = new Request("http://localhost/api/llm-logs/recent?limit=10")
    const response = await getRecentLlmLogs(request, { params: Promise.resolve({}) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.total).toBe(2)
  })
})
