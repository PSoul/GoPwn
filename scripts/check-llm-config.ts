import "dotenv/config"
import { prisma } from "../lib/infra/prisma"

async function main() {
  const profiles = await prisma.llmProfile.findMany()
  console.log("=== LLM Profiles ===")
  console.log(JSON.stringify(profiles, null, 2))

  const toolCount = await prisma.mcpTool.count()
  const tools = await prisma.mcpTool.findMany({ select: { id: true, toolName: true, status: true, capability: true } })
  console.log(`\n=== MCP Tools (${toolCount}) ===`)
  console.log(JSON.stringify(tools, null, 2))

  const serverCount = await prisma.mcpServerContract.count()
  const servers = await prisma.mcpServerContract.findMany()
  console.log(`\n=== MCP Servers (${serverCount}) ===`)
  console.log(JSON.stringify(servers, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
