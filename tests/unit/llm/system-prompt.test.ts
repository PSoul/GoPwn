import { describe, it, expect, vi, beforeEach } from "vitest"

const mockReadFile = vi.fn()
vi.mock("fs/promises", () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}))

import { loadSystemPrompt, invalidatePromptCache } from "@/lib/llm/system-prompt"

describe("system-prompt: loadSystemPrompt", () => {
  beforeEach(() => {
    invalidatePromptCache()
    vi.clearAllMocks()
  })

  it("文件存在 → 加载内容", async () => {
    mockReadFile.mockResolvedValue("  自定义方法论 prompt  ")

    const result = await loadSystemPrompt()

    expect(result).toBe("自定义方法论 prompt")
    expect(mockReadFile).toHaveBeenCalledOnce()
  })

  it("文件不存在 → 返回 fallback（包含安全评估）", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"))

    const result = await loadSystemPrompt()

    expect(result).toContain("安全评估")
    expect(mockReadFile).toHaveBeenCalledOnce()
  })
})
