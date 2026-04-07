import "dotenv/config"
import { prisma } from "@/lib/infra/prisma"

async function main() {
  // 查最近的 LLM 调用记录，看实际 response
  const logs = await prisma.llmCallLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      role: true,
      status: true,
      model: true,
      prompt: true,
      response: true,
      error: true,
      durationMs: true,
      createdAt: true,
    },
  })

  for (const log of logs) {
    console.log(`\n=== [${log.role}] ${log.status} @ ${log.createdAt.toISOString()} (${log.durationMs}ms) ===`)
    console.log(`Model: ${log.model}`)
    console.log(`Response (前500字): ${(log.response || "(空)").slice(0, 500)}`)
    if (log.error) console.log(`Error: ${log.error.slice(0, 200)}`)
    console.log(`Prompt (前300字): ${(log.prompt || "").slice(0, 300)}`)
  }

  await prisma.$disconnect()
}

main().catch((e) => { console.error(e.message); process.exit(1) })
