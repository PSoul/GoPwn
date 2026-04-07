import "dotenv/config"
import { prisma } from "@/lib/infra/prisma"

async function main() {
  // 最近的 MCP 调用记录
  const runs = await prisma.mcpRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      toolName: true,
      target: true,
      status: true,
      functionArgs: true,
      rawOutput: true,
      error: true,
      thought: true,
      createdAt: true,
      round: true,
      stepIndex: true,
    },
  })

  for (const r of runs) {
    console.log(`\n=== [R${r.round} Step${r.stepIndex}] ${r.toolName} → ${r.target} (${r.status}) @ ${r.createdAt.toISOString()} ===`)
    console.log(`functionArgs: ${JSON.stringify(r.functionArgs)}`)
    console.log(`rawOutput (前500字): ${(r.rawOutput || "(空)").slice(0, 500)}`)
    if (r.error) console.log(`error: ${r.error.slice(0, 200)}`)
    if (r.thought) console.log(`thought (前200字): ${r.thought.slice(0, 200)}`)
  }

  await prisma.$disconnect()
}

main().catch((e) => { console.error(e.message); process.exit(1) })
