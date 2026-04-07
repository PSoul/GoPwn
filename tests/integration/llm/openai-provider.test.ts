import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest"
import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"
import { createOpenAIProvider } from "@/lib/llm/openai-provider"
import * as handlers from "../../helpers/msw-handlers"

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const provider = createOpenAIProvider({
  apiKey: "test-key",
  baseUrl: "https://api.openai.test",
  model: "gpt-4",
  defaultTimeoutMs: 5000,
})

const simpleMessages = [{ role: "user" as const, content: "hello" }]

describe("openai-provider: createOpenAIProvider", () => {
  it("普通 chat 返回 content + durationMs", async () => {
    server.use(handlers.chatOk("hello world"))

    const res = await provider.chat(simpleMessages)

    expect(res.content).toBe("hello world")
    expect(res.durationMs).toBeGreaterThanOrEqual(0)
    expect(res.model).toBe("gpt-4")
    expect(res.provider).toBe("openai-compatible")
    expect(res.inputTokens).toBe(10)
    expect(res.outputTokens).toBe(20)
  })

  it("Function Calling 返回 functionCall", async () => {
    server.use(handlers.chatFunctionCall("scan", '{"target":"1.2.3.4"}'))

    const res = await provider.chat(simpleMessages, {
      functions: [{ name: "scan", description: "扫描", parameters: {} }],
    })

    expect(res.functionCall).toBeDefined()
    expect(res.functionCall!.name).toBe("scan")
    expect(res.functionCall!.arguments).toBe('{"target":"1.2.3.4"}')
    expect(res.toolCallId).toBe("call_1")
  })

  it("自定义 baseUrl（已含 /v1）不重复追加", async () => {
    const customHandler = http.post(
      "https://custom.test/v1/chat/completions",
      () =>
        HttpResponse.json({
          choices: [{ message: { content: "custom ok" } }],
          model: "gpt-4",
        }),
    )
    server.use(customHandler)

    const customProvider = createOpenAIProvider({
      apiKey: "k",
      baseUrl: "https://custom.test/v1",
      model: "gpt-4",
    })

    const res = await customProvider.chat(simpleMessages)
    expect(res.content).toBe("custom ok")
  })

  it("超时 → reject 包含 abort 相关信息", async () => {
    server.use(handlers.chatSlow(30_000))

    await expect(
      provider.chat(simpleMessages, { timeoutMs: 50 }),
    ).rejects.toThrow(/abort/i)
  })

  it("429 Rate Limit → reject 包含 429", async () => {
    server.use(handlers.chat429())

    await expect(provider.chat(simpleMessages)).rejects.toThrow(/429/)
  })

  it("500 Server Error → reject 包含 500", async () => {
    server.use(handlers.chat500())

    await expect(provider.chat(simpleMessages)).rejects.toThrow(/500/)
  })

  it("畸形 JSON → reject（不崩溃）", async () => {
    server.use(handlers.chatMalformed())

    await expect(provider.chat(simpleMessages)).rejects.toThrow()
  })

  it("AbortSignal 已中止 → reject aborted", async () => {
    server.use(handlers.chatOk("should not reach"))

    const controller = new AbortController()
    controller.abort()

    await expect(
      provider.chat(simpleMessages, { signal: controller.signal }),
    ).rejects.toThrow(/abort/i)
  })
})
