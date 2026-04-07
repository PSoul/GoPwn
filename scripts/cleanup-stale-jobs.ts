import "dotenv/config"
import { prisma } from "@/lib/infra/prisma"

async function main() {
  // 清理所有 created/retry/failed 状态的陈旧作业
  const deleted = await prisma.$executeRawUnsafe(
    `DELETE FROM pgboss.job WHERE state IN ('created', 'retry', 'failed')`,
  )
  console.log(`清理了 ${deleted} 个陈旧作业`)

  // 重置假执行状态的项目为 idle
  const updated = await prisma.project.updateMany({
    where: { lifecycle: { in: ["executing", "planning", "reviewing"] } },
    data: { lifecycle: "idle" },
  })
  console.log(`重置了 ${updated.count} 个项目为 idle`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("失败:", e.message)
  process.exit(1)
})
