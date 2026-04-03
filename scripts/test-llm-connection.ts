import "dotenv/config"

async function main() {
  const apiKey = "sk-pryesvbybgrplivmlsrfsbluaoyctebqchsqjjfhbnjtkedc"
  const baseUrl = "https://api.siliconflow.cn/v1"
  const model = "Pro/deepseek-ai/DeepSeek-V3"

  console.log(`Testing LLM connection: ${model} @ ${baseUrl}`)

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with just 'OK' if you can hear me." }],
      max_tokens: 10,
      temperature: 0,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`✗ LLM API error: ${res.status} ${text}`)
    return
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  const reply = data.choices?.[0]?.message?.content ?? "(no content)"
  console.log(`✓ LLM replied: ${reply}`)
  console.log(`  Model: ${model}`)
}

main().catch(console.error)
