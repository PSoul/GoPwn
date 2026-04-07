import "dotenv/config"
import { prisma } from "@/lib/infra/prisma"

async function main() {
  const tools = await prisma.mcpTool.findMany({
    where: { enabled: true },
    select: { toolName: true, serverName: true, description: true, capability: true },
    orderBy: { toolName: "asc" },
  })
  for (const t of tools) {
    console.log(`[${t.capability}] ${t.toolName} (${t.serverName}): ${(t.description || "").slice(0, 80)}`)
  }
  console.log(`\n共 ${tools.length} 个启用工具`)

  // 检查 fscan server 的配置
  const fscanServer = await prisma.mcpServer.findUnique({ where: { serverName: "fscan" } })
  if (fscanServer) {
    console.log(`\n=== fscan server 配置 ===`)
    console.log(`command: ${fscanServer.command}`)
    console.log(`args: ${JSON.stringify(fscanServer.args)}`)
    console.log(`cwd: ${fscanServer.cwd}`)
    console.log(`envJson: ${fscanServer.envJson}`)
    console.log(`enabled: ${fscanServer.enabled}`)
  } else {
    console.log("\n!! fscan server 不在数据库中 !!")
  }

  await prisma.$disconnect()
}

main().catch((e) => { console.error(e.message); process.exit(1) })
