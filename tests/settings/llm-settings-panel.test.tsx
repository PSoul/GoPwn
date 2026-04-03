import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { LlmSettingsPanel } from "@/components/settings/llm-settings-panel"
import type { LlmProfileRecord } from "@/lib/prototype-types"

const initialProfiles: LlmProfileRecord[] = [
  {
    id: "orchestrator",
    provider: "openai-compatible",
    label: "Default Orchestrator",
    apiKey: "",
    baseUrl: "",
    model: "",
    timeoutMs: 15000,
    temperature: 0.2,
    contextWindowSize: 65536,
    enabled: false,
  },
  {
    id: "reviewer",
    provider: "openai-compatible",
    label: "Default Reviewer",
    apiKey: "",
    baseUrl: "",
    model: "",
    timeoutMs: 15000,
    temperature: 0.1,
    contextWindowSize: 65536,
    enabled: false,
  },
  {
    id: "analyzer",
    provider: "openai-compatible",
    label: "Default Analyzer",
    apiKey: "",
    baseUrl: "",
    model: "",
    timeoutMs: 10000,
    temperature: 0,
    contextWindowSize: 65536,
    enabled: false,
  },
]

describe("LlmSettingsPanel", () => {
  beforeEach(() => {
    global.fetch = vi.fn() as unknown as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("persists per-role LLM settings edits through the real settings API", async () => {
    const savedProfile: LlmProfileRecord = {
      ...initialProfiles[0],
      apiKey: "sk-debug",
      baseUrl: "https://api.siliconflow.cn/",
      model: "Pro/deepseek-ai/DeepSeek-V3.2",
      timeoutMs: 300000,
      temperature: 0.15,
      enabled: true,
    }

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        profile: savedProfile,
        profiles: [savedProfile, ...initialProfiles.slice(1)],
      }),
    } as Response)

    render(<LlmSettingsPanel initialProfiles={initialProfiles} />)

    fireEvent.change(screen.getByLabelText("API Key · Default Orchestrator"), {
      target: { value: "sk-debug" },
    })
    fireEvent.change(screen.getByLabelText("Base URL · Default Orchestrator"), {
      target: { value: "https://api.siliconflow.cn/" },
    })
    fireEvent.change(screen.getByLabelText("Model · Default Orchestrator"), {
      target: { value: "Pro/deepseek-ai/DeepSeek-V3.2" },
    })
    fireEvent.change(screen.getByLabelText("Timeout · Default Orchestrator"), {
      target: { value: "300000" },
    })
    fireEvent.change(screen.getByLabelText("Temperature · Default Orchestrator"), {
      target: { value: "0.15" },
    })
    fireEvent.click(screen.getByRole("switch", { name: "启用 Default Orchestrator" }))
    fireEvent.click(screen.getByRole("button", { name: "保存 Default Orchestrator" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/settings/llm",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify(savedProfile),
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText("LLM 配置 Default Orchestrator 已保存。")).toBeInTheDocument()
    })
  })
})
