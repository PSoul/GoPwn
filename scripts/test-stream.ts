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

  // 测试1: 非流式（当前方式）
  console.log("=== 非流式 (stream=false) ===")
  const r1 = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: profile.model,
      messages: [{ role: "user", content: "Say hello" }],
      stream: false,
    }),
  })
  const d1 = await r1.json()
  console.log("content:", JSON.stringify(d1.choices?.[0]?.message?.content))
  console.log("reasoning:", JSON.stringify(d1.choices?.[0]?.message?.reasoning_content))

  // 测试2: 流式（Codex 的方式）
  console.log("\n=== 流式 (stream=true) ===")
  const r2 = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: profile.model,
      messages: [{ role: "user", content: "Say hello" }],
      stream: true,
    }),
  })

  const reader = r2.body?.getReader()
  const decoder = new TextDecoder()
  let fullContent = ""
  let fullReasoning = ""

  if (reader) {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split("\n").filter(l => l.startsWith("data: "))
      for (const line of lines) {
        const data = line.slice(6).trim()
        if (data === "[DONE]") continue
        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta
          if (delta?.content) fullContent += delta.content
          if (delta?.reasoning_content) fullReasoning += delta.reasoning_content
        } catch {}
      }
    }
  }

  console.log("content:", JSON.stringify(fullContent || null))
  console.log("reasoning:", JSON.stringify(fullReasoning || null))

  await prisma.$disconnect()
}

main().catch((e) => { console.error(e.message); process.exit(1) })
