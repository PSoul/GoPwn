import "dotenv/config"
import { prisma } from "@/lib/infra/prisma"

async function main() {
  const runs = await prisma.mcpRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      toolName: true,
      target: true,
      status: true,
      functionArgs: true,
      rawOutput: true,
      round: true,
      stepIndex: true,
    },
  })

  for (const r of runs) {
    process.stdout.write(`\n[R${r.round} S${r.stepIndex}] ${r.toolName} -> ${r.target} (${r.status})\n`)
    process.stdout.write(`args: ${JSON.stringify(r.functionArgs)}\n`)
    process.stdout.write(`output(500): ${(r.rawOutput || "(empty)").slice(0, 500)}\n`)
  }

  await prisma.$disconnect()
}

main().catch((e) => { process.stderr.write(e.message + "\n"); process.exit(1) })
