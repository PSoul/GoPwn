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

  // 测试1: 最简单的请求
  console.log("=== 测试1: 最简单请求 ===")
  const r1 = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: profile.model,
      messages: [{ role: "user", content: "Say hello" }],
    }),
  })
  const d1 = await r1.json()
  console.log("content:", JSON.stringify(d1.choices?.[0]?.message?.content))
  console.log("reasoning_content:", JSON.stringify(d1.choices?.[0]?.message?.reasoning_content))
  console.log("finish_reason:", d1.choices?.[0]?.finish_reason)
  console.log("usage:", JSON.stringify(d1.usage))

  // 测试2: 查看可用模型
  console.log("\n=== 测试2: 列出可用模型 ===")
  const modelsUrl = cleanBase.endsWith("/v1") ? `${cleanBase}/models` : `${cleanBase}/v1/models`
  try {
    const r2 = await fetch(modelsUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (r2.ok) {
      const d2 = await r2.json()
      const models = d2.data?.map((m: { id: string }) => m.id) ?? []
      console.log(`共 ${models.length} 个模型`)
      // 找包含 gpt 的模型
      const gptModels = models.filter((m: string) => m.toLowerCase().includes("gpt"))
      console.log("GPT 相关:", gptModels.slice(0, 20).join(", "))
      // 找包含 claude 的模型
      const claudeModels = models.filter((m: string) => m.toLowerCase().includes("claude"))
      console.log("Claude 相关:", claudeModels.slice(0, 10).join(", "))
    } else {
      console.log(`Status: ${r2.status}`)
    }
  } catch (e) {
    console.log("模型列表不可用")
  }

  // 测试3: 尝试 gpt-4o 模型
  console.log("\n=== 测试3: 尝试 gpt-4o ===")
  const r3 = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Say hello" }],
    }),
  })
  const d3 = await r3.json()
  console.log("content:", JSON.stringify(d3.choices?.[0]?.message?.content))
  console.log("error:", JSON.stringify(d3.error))

  // 测试4: 尝试带 stream: false 显式关闭流
  console.log("\n=== 测试4: stream=false + gpt-5.3-codex ===")
  const r4 = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: profile.model,
      messages: [{ role: "user", content: "Say hello" }],
      stream: false,
    }),
  })
  const d4 = await r4.json()
  console.log("content:", JSON.stringify(d4.choices?.[0]?.message?.content))
  console.log("full message:", JSON.stringify(d4.choices?.[0]?.message))

  await prisma.$disconnect()
}

main().catch((e) => { console.error(e.message); process.exit(1) })
