import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../lib/generated/prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("=== Prisma Data Layer Verification ===\n")

  // Test 1: List projects
  const projects = await prisma.project.findMany({ take: 5 })
  console.log(`✓ Projects: ${projects.length} found, first: "${projects[0]?.name}"`)

  // Test 2: Get user
  const users = await prisma.user.findMany()
  console.log(`✓ Users: ${users.length}, account: ${users[0]?.account}`)

  // Test 3: Get project detail with JSON columns
  const detail = await prisma.projectDetail.findFirst()
  console.log(`✓ ProjectDetail: ${detail?.projectId}, timeline items: ${Array.isArray(detail?.timeline) ? (detail?.timeline as unknown[]).length : 'N/A'}`)

  // Test 4: Get MCP tools
  const tools = await prisma.mcpTool.findMany({ take: 5 })
  console.log(`✓ MCP Tools: ${tools.length} — ${tools.map(t => t.toolName).join(", ")}`)

  // Test 5: Get scheduler tasks
  const tasks = await prisma.schedulerTask.findMany({ take: 3 })
  console.log(`✓ Scheduler Tasks: ${tasks.length}, first status: ${tasks[0]?.status}`)

  // Test 6: Get LLM profiles
  const profiles = await prisma.llmProfile.findMany()
  console.log(`✓ LLM Profiles: ${profiles.length}`)

  // Test 7: Get MCP runs
  const runs = await prisma.mcpRun.findMany({ take: 3 })
  console.log(`✓ MCP Runs: ${runs.length}, first: ${runs[0]?.toolName}`)

  // Test 8: Get evidence
  const evidence = await prisma.evidence.findMany({ take: 3 })
  console.log(`✓ Evidence: ${evidence.length}`)

  // Test 9: Get audit logs
  const auditCount = await prisma.auditLog.count()
  console.log(`✓ Audit Logs: ${auditCount}`)

  // Test 10: Get orchestrator plans
  const plans = await prisma.orchestratorPlan.findMany()
  console.log(`✓ Orchestrator Plans: ${plans.length}`)

  // Test 11: Complex query — project with related data
  const projectWithRelations = await prisma.project.findFirst({
    include: {
      detail: true,
      assets: { take: 2 },
      findings: { take: 2 },
      mcpRuns: { take: 2 },
    },
  })
  if (projectWithRelations) {
    console.log(`✓ Project relations: detail=${!!projectWithRelations.detail}, assets=${projectWithRelations.assets.length}, findings=${projectWithRelations.findings.length}, runs=${projectWithRelations.mcpRuns.length}`)
  }

  // Test 12: Aggregation
  const statusCounts = await prisma.project.groupBy({
    by: ["status"],
    _count: true,
  })
  console.log(`✓ Project status distribution: ${statusCounts.map(s => `${s.status}(${s._count})`).join(", ")}`)

  await prisma.$disconnect()
  console.log("\n=== All Prisma verification queries passed! ===")
}

main().catch((e) => {
  console.error("FAILED:", e.message)
  process.exit(1)
})
