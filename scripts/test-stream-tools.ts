import "dotenv/config"
import { prisma } from "@/lib/infra/prisma"

async function main() {
  const profile = await prisma.llmProfile.findFirst()
  if (!profile) { console.log("无 profile"); return }

  const cleanBase = profile.baseUrl.replace(/\/+$/, "")
  const url = cleanBase.endsWith("/v1")
    ? `${cleanBase}/chat/completions`
    : `${cleanBase}/v1/chat/completions`
  const apiKey = profile.apiKey

  // 测试: 流式 + function calling
  console.log("=== 流式 + tools ===")
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: profile.model,
      messages: [
        { role: "system", content: "You are a helpful assistant. You must use tools to respond." },
        { role: "user", content: "Test the connection to 192.168.1.1" },
      ],
      tools: [{
        type: "function",
        function: {
          name: "nmap_scan",
          description: "Scan a target host",
          parameters: { type: "object", properties: { target: { type: "string" } }, required: ["target"] },
        },
      }],
      tool_choice: "auto",
      stream: true,
      stream_options: { include_usage: true },
    }),
  })

  const reader = r.body?.getReader()
  const decoder = new TextDecoder()
  let content = ""
  const toolCalls = new Map<number, { id: string; name: string; arguments: string }>()
  let buffer = ""

  if (reader) {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const data = line.slice(6).trim()
        if (data === "[DONE]") continue
        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta
          if (!delta) continue
          if (delta.content) content += delta.content
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0
              const existing = toolCalls.get(idx)
              if (!existing) {
                toolCalls.set(idx, { id: tc.id ?? "", name: tc.function?.name ?? "", arguments: tc.function?.arguments ?? "" })
              } else {
                if (tc.id) existing.id = tc.id
                if (tc.function?.name) existing.name += tc.function.name
                if (tc.function?.arguments) existing.arguments += tc.function.arguments
              }
            }
          }
        } catch {}
      }
    }
  }

  console.log("content:", JSON.stringify(content || null))
  console.log("tool_calls:", JSON.stringify([...toolCalls.values()], null, 2))

  // 测试: 通过 openai-provider 代码调用
  console.log("\n=== 通过 openai-provider 调用 ===")
  const { createOpenAIProvider } = await import("@/lib/llm/openai-provider")
  const provider = createOpenAIProvider({
    apiKey,
    baseUrl: profile.baseUrl,
    model: profile.model,
  })
  const resp = await provider.chat(
    [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Say hello briefly" },
    ],
  )
  console.log("content:", JSON.stringify(resp.content))
  console.log("functionCall:", JSON.stringify(resp.functionCall))
  console.log("durationMs:", resp.durationMs)

  await prisma.$disconnect()
}

main().catch((e) => { console.error(e.message); process.exit(1) })
