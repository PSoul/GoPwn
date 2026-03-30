import { beforeEach, describe, expect, it } from "vitest"

import {
  createLlmCallLog,
  appendLlmCallResponse,
  completeLlmCallLog,
  failLlmCallLog,
  listLlmCallLogs,
  getLlmCallLogById,
  listAllRecentLlmCallLogs,
} from "@/lib/llm-call-logger"
import { createStoredProjectFixture } from "@/tests/helpers/project-fixtures"

describe("llm-call-logger", () => {
  let proj1Id: string
  let proj2Id: string

  beforeEach(async () => {
    const fixture1 = await createStoredProjectFixture({ name: "LLM Logger Test 1" })
    const fixture2 = await createStoredProjectFixture({ name: "LLM Logger Test 2" })
    proj1Id = fixture1.project.id
    proj2Id = fixture2.project.id
  })

  it("creates a log with streaming status", async () => {
    const log = await createLlmCallLog({
      projectId: proj1Id,
      role: "orchestrator",
      phase: "planning",
      prompt: "Test prompt",
      model: "gpt-4",
      provider: "openai",
    })

    expect(log.id).toBeTruthy()
    expect(log.status).toBe("streaming")
    expect(log.response).toBe("")
    expect(log.completedAt).toBeNull()
  })

  it("appends response chunks", async () => {
    const log = await createLlmCallLog({
      projectId: proj1Id,
      role: "orchestrator",
      phase: "planning",
      prompt: "p",
      model: "m",
      provider: "p",
    })

    await appendLlmCallResponse(log.id, "chunk1")
    await appendLlmCallResponse(log.id, "chunk2")

    const fetched = await getLlmCallLogById(log.id)
    expect(fetched?.response).toBe("chunk1chunk2")
  })

  it("completes a log", async () => {
    const log = await createLlmCallLog({
      projectId: proj1Id,
      role: "reviewer",
      phase: "reviewing",
      prompt: "p",
      model: "m",
      provider: "p",
    })

    await completeLlmCallLog(log.id, {
      response: "full response",
      durationMs: 500,
      tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    })

    const fetched = await getLlmCallLogById(log.id)
    expect(fetched?.status).toBe("completed")
    expect(fetched?.response).toBe("full response")
    expect(fetched?.durationMs).toBe(500)
    expect(fetched?.tokenUsage?.totalTokens).toBe(30)
    expect(fetched?.completedAt).not.toBeNull()
  })

  it("marks a log as failed", async () => {
    const log = await createLlmCallLog({
      projectId: proj1Id,
      role: "orchestrator",
      phase: "planning",
      prompt: "p",
      model: "m",
      provider: "p",
    })

    await failLlmCallLog(log.id, "timeout")

    const fetched = await getLlmCallLogById(log.id)
    expect(fetched?.status).toBe("failed")
    expect(fetched?.error).toBe("timeout")
  })

  it("lists logs filtered by project and role", async () => {
    await createLlmCallLog({ projectId: proj1Id, role: "orchestrator", phase: "planning", prompt: "1", model: "m", provider: "p" })
    await createLlmCallLog({ projectId: proj1Id, role: "reviewer", phase: "reviewing", prompt: "2", model: "m", provider: "p" })
    await createLlmCallLog({ projectId: proj2Id, role: "orchestrator", phase: "planning", prompt: "3", model: "m", provider: "p" })

    const all = await listLlmCallLogs(proj1Id)
    expect(all).toHaveLength(2)

    const orchestratorOnly = await listLlmCallLogs(proj1Id, { role: "orchestrator" })
    expect(orchestratorOnly).toHaveLength(1)
    expect(orchestratorOnly[0].role).toBe("orchestrator")
  })

  it("returns recent logs across all projects", async () => {
    await createLlmCallLog({ projectId: proj1Id, role: "orchestrator", phase: "planning", prompt: "1", model: "m", provider: "p" })
    await createLlmCallLog({ projectId: proj2Id, role: "reviewer", phase: "reviewing", prompt: "2", model: "m", provider: "p" })

    const recent = await listAllRecentLlmCallLogs(10)
    expect(recent).toHaveLength(2)
  })

  it("returns null for non-existent log id", async () => {
    expect(await getLlmCallLogById("nonexistent")).toBeNull()
  })
})
