import "dotenv/config"
import { prisma } from "@/lib/infra/prisma"

async function main() {
  // 1. 项目状态
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, lifecycle: true, currentRound: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 5,
  })
  console.log("=== 项目 ===")
  if (projects.length === 0) console.log("  (无项目)")
  for (const p of projects) {
    console.log(`  [${p.lifecycle}] ${p.name} round=${p.currentRound} updated=${p.updatedAt.toISOString()}`)
  }

  // 2. pg-boss 作业
  try {
    const jobs: { name: string; state: string; count: number }[] = await prisma.$queryRawUnsafe(
      `SELECT name, state, COUNT(*)::int as count FROM pgboss.job GROUP BY name, state ORDER BY name, state`,
    )
    console.log("\n=== pg-boss 作业 ===")
    if (jobs.length === 0) console.log("  (空队列)")
    for (const j of jobs) console.log(`  ${j.name} [${j.state}]: ${j.count}`)
  } catch (e) {
    console.log("  pg-boss schema 不存在 (worker 未启动过)")
  }

  // 3. LLM profiles
  const profiles = await prisma.llmProfile.findMany({
    select: { role: true, model: true, baseUrl: true },
  })
  console.log("\n=== LLM Profiles ===")
  if (profiles.length === 0) {
    console.log("  !! 未配置任何 LLM profile — 这会导致项目无法运行 !!")
  }
  for (const p of profiles) {
    console.log(`  ${p.role}: ${p.model} @ ${p.baseUrl || "N/A"}`)
  }

  // 4. 最近 LLM 调用
  const logs = await prisma.llmCallLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { role: true, status: true, createdAt: true, error: true, projectId: true },
  })
  console.log("\n=== 最近 LLM 调用 ===")
  if (logs.length === 0) console.log("  (无记录)")
  for (const l of logs) {
    console.log(`  [${l.status}] ${l.role} ${l.createdAt.toISOString()}${l.error ? " ERR:" + l.error.slice(0, 100) : ""}`)
  }

  // 5. MCP 工具
  const tools = await prisma.mcpTool.findMany({
    where: { enabled: true },
    select: { toolName: true, serverName: true },
  })
  console.log("\n=== 启用的 MCP 工具 ===")
  if (tools.length === 0) {
    console.log("  !! 没有启用的 MCP 工具 — 这会导致 ReAct 循环无工具可用 !!")
  } else {
    console.log(`  ${tools.length} 个工具: ${tools.map((t) => t.toolName).join(", ")}`)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("诊断失败:", e.message)
  process.exit(1)
})
