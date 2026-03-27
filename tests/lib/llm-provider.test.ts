import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getConfiguredLlmProviderStatus, resolveLlmProvider } from "@/lib/llm-provider/registry"
import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"

describe("LLM provider registry", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete process.env.LLM_PROVIDER
    delete process.env.LLM_BASE_URL
    delete process.env.LLM_API_KEY
    delete process.env.LLM_ORCHESTRATOR_MODEL
    delete process.env.LLM_REVIEWER_MODEL
    delete process.env.LLM_TIMEOUT_MS
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns a disabled status when no provider configuration is present", () => {
    const status = getConfiguredLlmProviderStatus()
    const provider = resolveLlmProvider()

    expect(status.enabled).toBe(false)
    expect(provider).toBeNull()
    expect(status.note).toContain("未配置")
  })

  it("prefers persisted prototype-store profiles before env vars", () => {
    const store = readPrototypeStore()
    store.llmProfiles = store.llmProfiles.map((profile) =>
      profile.id === "orchestrator"
        ? {
            ...profile,
            apiKey: "sk-store-priority",
            baseUrl: "https://api.siliconflow.cn/v1",
            model: "Pro/deepseek-ai/DeepSeek-V3.2",
            timeoutMs: 21000,
            temperature: 0.1,
            enabled: true,
          }
        : profile.id === "reviewer"
          ? {
              ...profile,
              apiKey: "sk-store-priority",
              baseUrl: "https://api.siliconflow.cn/v1",
              model: "Qwen/Qwen2.5-7B-Instruct",
              timeoutMs: 18000,
              temperature: 0.05,
              enabled: true,
            }
          : profile,
    )
    writePrototypeStore(store)

    const status = getConfiguredLlmProviderStatus()
    const provider = resolveLlmProvider()

    expect(status.enabled).toBe(true)
    expect(status.baseUrl).toBe("https://api.siliconflow.cn/v1")
    expect(status.orchestratorModel).toBe("Pro/deepseek-ai/DeepSeek-V3.2")
    expect(provider).not.toBeNull()
  })

  it("builds an enabled provider status from env configuration", () => {
    process.env.LLM_PROVIDER = "openai-compatible"
    process.env.LLM_BASE_URL = "https://api.siliconflow.cn/v1"
    process.env.LLM_API_KEY = "sk-test"
    process.env.LLM_ORCHESTRATOR_MODEL = "Pro/deepseek-ai/DeepSeek-V3.2"
    process.env.LLM_REVIEWER_MODEL = "Qwen/Qwen2.5-7B-Instruct"

    const status = getConfiguredLlmProviderStatus()

    expect(status.enabled).toBe(true)
    expect(status.provider).toBe("openai-compatible")
    expect(status.baseUrl).toBe("https://api.siliconflow.cn/v1")
    expect(status.orchestratorModel).toBe("Pro/deepseek-ai/DeepSeek-V3.2")
  })

  it("sends OpenAI-compatible chat completion requests and parses the assistant JSON response", async () => {
    process.env.LLM_PROVIDER = "openai-compatible"
    process.env.LLM_BASE_URL = "https://api.siliconflow.cn/v1"
    process.env.LLM_API_KEY = "sk-test"
    process.env.LLM_ORCHESTRATOR_MODEL = "Pro/deepseek-ai/DeepSeek-V3.2"
    process.env.LLM_REVIEWER_MODEL = "Qwen/Qwen2.5-7B-Instruct"
    process.env.LLM_TIMEOUT_MS = "3000"

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "围绕本地靶场先做低风险识别，再挂一个需要审批的验证动作。",
                items: [
                  {
                    capability: "目标解析类",
                    requestedAction: "标准化本地靶场目标",
                    target: "http://127.0.0.1:3000",
                    riskLevel: "低",
                    rationale: "先把入口归一化。",
                  },
                ],
              }),
            },
          },
        ],
      }),
    }) as unknown as typeof fetch

    const provider = resolveLlmProvider()

    if (!provider) {
      throw new Error("Expected provider to be configured.")
    }

    const response = await provider.generatePlan({
      prompt: "为本地 Juice Shop 生成最小闭环验证计划",
      purpose: "orchestrator",
    })

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.siliconflow.cn/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
      }),
    )
    expect(response.provider).toBe("openai-compatible")
    expect(response.model).toBe("Pro/deepseek-ai/DeepSeek-V3.2")
    expect(response.content.summary).toContain("低风险识别")
    expect(response.content.items).toHaveLength(1)
  })
})
