import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GET as getLlmSettings, PATCH as patchLlmSettings } from "@/app/api/settings/llm/route"
import { prisma } from "@/lib/prisma"

describe("llm settings api route", () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-llm-settings-store-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir

    // Seed the 3 default LLM profiles that tests expect
    await prisma.llmProfile.createMany({
      data: [
        { id: "orchestrator", provider: "openai-compatible", label: "Orchestrator", apiKey: "", baseUrl: "", model: "", timeoutMs: 120000, temperature: 0.2, enabled: false },
        { id: "reviewer", provider: "openai-compatible", label: "Reviewer", apiKey: "", baseUrl: "", model: "", timeoutMs: 120000, temperature: 0.2, enabled: false },
        { id: "analyzer", provider: "openai-compatible", label: "Analyzer", apiKey: "", baseUrl: "", model: "", timeoutMs: 120000, temperature: 0.2, enabled: false },
      ],
      skipDuplicates: true,
    })
  })

  afterEach(() => {
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("returns persisted LLM profiles from the prototype store", async () => {
    const response = await getLlmSettings(
      new Request("http://localhost/api/settings/llm"),
      { params: Promise.resolve({}) },
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.profiles).toHaveLength(3)
    expect(payload.profiles.map((item: { id: string }) => item.id)).toEqual(["orchestrator", "reviewer", "analyzer"])
    expect(payload.profiles[0].apiKey).toBe("")
  })

  it("persists plaintext LLM profile settings so runtime resolution can use them", async () => {
    const response = await patchLlmSettings(
      new Request("http://localhost/api/settings/llm", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          id: "orchestrator",
          provider: "openai-compatible",
          label: "SiliconFlow Orchestrator",
          apiKey: "sk-real-debug",
          baseUrl: "https://api.siliconflow.cn/v1",
          model: "Pro/deepseek-ai/DeepSeek-V3.2",
          timeoutMs: 22000,
          temperature: 0.15,
          enabled: true,
          contextWindowSize: 65536,
        }),
      }),
      { params: Promise.resolve({}) },
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.profile.id).toBe("orchestrator")
    expect(payload.profile.apiKey).toBe("sk-real-debug")
    expect(payload.profile.enabled).toBe(true)

    const nextResponse = await getLlmSettings(
      new Request("http://localhost/api/settings/llm"),
      { params: Promise.resolve({}) },
    )
    const nextPayload = await nextResponse.json()
    const profile = nextPayload.profiles.find((item: { id: string }) => item.id === "orchestrator")

    expect(profile?.baseUrl).toBe("https://api.siliconflow.cn/v1")
    expect(profile?.model).toBe("Pro/deepseek-ai/DeepSeek-V3.2")
    expect(profile?.timeoutMs).toBe(22000)
    expect(profile?.temperature).toBe(0.15)
  })
})
