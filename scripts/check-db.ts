import "dotenv/config"
import { prisma } from "../lib/infra/prisma"

async function main() {
  const tools = await prisma.mcpTool.findMany({ where: { enabled: true }, select: { toolName: true, capability: true, serverName: true } })
  console.log("=== Registered tools:", tools.length)
  for (const t of tools) console.log(" ", t.serverName, "|", t.toolName, "|", t.capability)

  const servers = await prisma.mcpServer.findMany({ where: { enabled: true }, select: { serverName: true, transport: true } })
  console.log("=== Servers:", servers.length)

  const profiles = await prisma.llmProfile.findMany({ select: { id: true, baseUrl: true, model: true } })
  console.log("=== LLM profiles:", profiles.length)
  for (const p of profiles) console.log(" ", p.id, "|", p.baseUrl, "|", p.model)

  const projects = await prisma.project.findMany({ select: { id: true, name: true, lifecycle: true, currentPhase: true, currentRound: true } })
  console.log("=== Projects:", projects.length)
  for (const p of projects) console.log(" ", p.id, "|", p.name, "|", p.lifecycle, "|", p.currentPhase, "|", "round", p.currentRound)

  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
