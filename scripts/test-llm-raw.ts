import "dotenv/config"
import { prisma } from "@/lib/infra/prisma"

async function main() {
  // 从数据库读取 LLM 配置
  const profiles = await prisma.llmProfile.findMany()
  console.log("=== LLM Profiles ===")
  for (const p of profiles) {
    console.log(`  ${p.id}: model=${p.model} baseUrl=${p.baseUrl} provider=${p.provider}`)
  }

  // 用第一个 profile 发测试请求
  const profile = profiles[0]
  if (!profile) {
    console.log("没有 LLM profile")
    return
  }

  const cleanBase = profile.baseUrl.replace(/\/+$/, "")
  const url = cleanBase.endsWith("/v1")
    ? `${cleanBase}/chat/completions`
    : `${cleanBase}/v1/chat/completions`

  console.log(`\n=== 测试调用 ${url} ===`)
  console.log(`Model: ${profile.model}`)

  const body = {
    model: profile.model,
    messages: [
      { role: "system", content: "你是助手" },
      { role: "user", content: "说 hello" },
    ],
    temperature: 0.2,
    max_tokens: 100,
    tools: [{
      type: "function",
      function: {
        name: "test_tool",
        description: "A test tool",
        parameters: { type: "object", properties: { msg: { type: "string" } } },
      },
    }],
    tool_choice: "auto",
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${profile.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  console.log(`Status: ${res.status}`)
  const raw = await res.text()
  console.log(`Raw response:\n${raw.slice(0, 2000)}`)

  // 不带 tools 再试一次
  console.log("\n=== 不带 tools 再试 ===")
  const body2 = { ...body, tools: undefined, tool_choice: undefined }
  const res2 = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${profile.apiKey}`,
    },
    body: JSON.stringify(body2),
  })
  const raw2 = await res2.text()
  console.log(`Status: ${res2.status}`)
  console.log(`Raw response:\n${raw2.slice(0, 2000)}`)

  await prisma.$disconnect()
}

main().catch((e) => { console.error(e.message); process.exit(1) })
