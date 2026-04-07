import "dotenv/config"
import { resolve } from "path"
import { existsSync } from "fs"
import { prisma } from "@/lib/infra/prisma"

async function main() {
  const servers = await prisma.mcpServer.findMany()
  let fixed = 0

  for (const server of servers) {
    if (!server.envJson) continue

    const env = JSON.parse(server.envJson) as Record<string, string>
    let changed = false

    for (const [key, value] of Object.entries(env)) {
      if (!key.endsWith("_PATH") || !value) continue
      // 跳过已经是绝对路径的
      if (value.startsWith("/") || /^[A-Z]:\\/i.test(value)) continue

      const abs = resolve(process.cwd(), value)
      if (existsSync(abs)) {
        console.log(`  ${server.serverName}: ${key} = ${value} → ${abs}`)
        env[key] = abs
        changed = true
      } else {
        console.log(`  ${server.serverName}: ${key} = ${value} (文件不存在，跳过)`)
      }
    }

    if (changed) {
      await prisma.mcpServer.update({
        where: { serverName: server.serverName },
        data: { envJson: JSON.stringify(env) },
      })
      fixed++
    }
  }

  console.log(`\n修复了 ${fixed} 个 MCP server 的路径配置`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e.message); process.exit(1) })
