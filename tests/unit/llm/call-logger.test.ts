import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mock 依赖 ──
vi.mock("@/lib/repositories/llm-log-repo", () => ({
  create: vi.fn().mockResolvedValue({ id: "log-001" }),
  complete: vi.fn().mockResolvedValue({}),
  fail: vi.fn().mockResolvedValue({}),
}))

vi.mock("@/lib/infra/event-bus", () => ({
  publishEvent: vi.fn().mockResolvedValue(undefined),
}))

import * as llmLogRepo from "@/lib/repositories/llm-log-repo"
import { publishEvent } from "@/lib/infra/event-bus"
import { createLoggedProvider } from "@/lib/llm/call-logger"
import type { LlmProvider, LlmMessage } from "@/lib/llm/provider"

describe("call-logger: createLoggedProvider", () => {
  const ctx = { projectId: "proj-001", role: "planner", phase: "planning" }
  const messages: LlmMessage[] = [
    { role: "system", content: "You are a tester" },
    { role: "user", content: "Scan the target" },
  ]

  let innerProvider: LlmProvider
  let logged: LlmProvider

  beforeEach(() => {
    vi.clearAllMocks()
    innerProvider = {
      name: "test-provider",
      chat: vi.fn().mockResolvedValue({
        content: "result text",
        model: "gpt-test",
        provider: "test-provider",
        durationMs: 500,
      }),
    }
    logged = createLoggedProvider(innerProvider, ctx)
  })

  it("正常调用：创建日志 → 调用内部 provider → 完成日志", async () => {
    const result = await logged.chat(messages)

    // 验证返回值透传
    expect(result.content).toBe("result text")
    expect(result.model).toBe("gpt-test")

    // 验证日志创建
    expect(llmLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "proj-001",
        role: "planner",
        phase: "planning",
        provider: "test-provider",
      }),
    )

    // 验证日志完成
    expect(llmLogRepo.complete).toHaveBeenCalledWith(
      "log-001",
      expect.any(String),
      500,
      "gpt-test",
    )

    // 验证事件发布
    expect(publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "llm_call_started" }),
    )
    expect(publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "llm_call_completed" }),
    )
  })

  it("provider 名称透传", () => {
    expect(logged.name).toBe("test-provider")
  })

  it("调用失败：记录错误并重新抛出", async () => {
    const error = new Error("API timeout")
    vi.mocked(innerProvider.chat).mockRejectedValueOnce(error)

    await expect(logged.chat(messages)).rejects.toThrow("API timeout")

    // 验证失败日志
    expect(llmLogRepo.fail).toHaveBeenCalledWith("log-001", "API timeout")

    // 验证失败事件
    expect(publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "llm_call_failed" }),
    )
  })

  it("prompt 截断到 50000 字符", async () => {
    const longMessages: LlmMessage[] = [
      { role: "system", content: "x".repeat(60000) },
    ]
    await logged.chat(longMessages)

    const createCall = vi.mocked(llmLogRepo.create).mock.calls[0][0]
    expect((createCall as { prompt: string }).prompt.length).toBeLessThanOrEqual(50000)
  })

  it("functionCall 摘要附加到日志响应", async () => {
    vi.mocked(innerProvider.chat).mockResolvedValueOnce({
      content: "思考结果",
      model: "gpt-test",
      provider: "test-provider",
      durationMs: 300,
      functionCall: {
        name: "fscan_port_scan",
        arguments: '{"target":"127.0.0.1"}',
      },
    })

    await logged.chat(messages)

    const completeCall = vi.mocked(llmLogRepo.complete).mock.calls[0]
    const loggedResponse = completeCall[1] as string
    expect(loggedResponse).toContain("[Function Call]")
    expect(loggedResponse).toContain("fscan_port_scan")
    expect(loggedResponse).toContain("思考结果")
  })

  it("response 截断到 100000 字符", async () => {
    vi.mocked(innerProvider.chat).mockResolvedValueOnce({
      content: "y".repeat(120000),
      model: "gpt-test",
      provider: "test-provider",
      durationMs: 100,
    })

    await logged.chat(messages)

    const completeCall = vi.mocked(llmLogRepo.complete).mock.calls[0]
    const loggedResponse = completeCall[1] as string
    expect(loggedResponse.length).toBeLessThanOrEqual(100000)
  })

  it("事件发布失败不影响主流程", async () => {
    vi.mocked(publishEvent).mockRejectedValue(new Error("event bus down"))

    // 不应抛错
    const result = await logged.chat(messages)
    expect(result.content).toBe("result text")
  })
})
