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

  const modelsToTest = ["claude-sonnet-4-6", "gpt-5", "gpt-5.4", "gpt-5.1"]

  for (const model of modelsToTest) {
    console.log(`\n=== ${model} ===`)
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Say hello in one word" }],
          max_tokens: 50,
        }),
      })
      const d = await r.json()
      if (d.error) {
        console.log("错误:", d.error.message)
      } else {
        console.log("content:", JSON.stringify(d.choices?.[0]?.message?.content))
        console.log("reasoning:", JSON.stringify(d.choices?.[0]?.message?.reasoning_content))
        console.log("tokens:", JSON.stringify(d.usage))
      }
    } catch (e: unknown) {
      console.log("请求失败:", e instanceof Error ? e.message : e)
    }
  }

  await prisma.$disconnect()
}

main().catch((e) => { console.error(e.message); process.exit(1) })
