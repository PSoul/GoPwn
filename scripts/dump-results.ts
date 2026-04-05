import "dotenv/config"
import { prisma } from "@/lib/infra/prisma"

async function main() {
  const projectId = "cmnkl4uhs0000bkuyebxsqm1r"

  // Findings summary
  const findings = await prisma.finding.findMany({
    where: { projectId },
    select: { title: true, severity: true, status: true, summary: true, affectedTarget: true },
    orderBy: { severity: "asc" },
  })

  console.log(`\n=== DVWA 渗透测试结果 ===`)
  console.log(`总发现数: ${findings.length}`)

  const bySeverity: Record<string, number> = {}
  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1
  }
  console.log(`\n按严重程度:`)
  for (const [sev, count] of Object.entries(bySeverity).sort()) {
    console.log(`  ${sev}: ${count}`)
  }

  console.log(`\n详细发现列表:`)
  for (const f of findings) {
    console.log(`  [${f.severity}] ${f.title} - ${f.status}${f.affectedTarget ? ` → ${f.affectedTarget}` : ""}`)
  }

  // Assets summary
  const assets = await prisma.asset.findMany({
    where: { projectId },
    select: { kind: true, value: true },
    orderBy: { kind: "asc" },
  })

  console.log(`\n=== 资产清单 (${assets.length}) ===`)
  const byType: Record<string, string[]> = {}
  for (const a of assets) {
    if (!byType[a.kind]) byType[a.kind] = []
    byType[a.kind].push(a.value)
  }
  for (const [type, values] of Object.entries(byType)) {
    console.log(`\n${type} (${values.length}):`)
    for (const v of values.slice(0, 20)) {
      console.log(`  ${v}`)
    }
    if (values.length > 20) console.log(`  ... and ${values.length - 20} more`)
  }

  // Successful MCP runs
  const runs = await prisma.mcpRun.findMany({
    where: { projectId, status: "succeeded" },
    select: { toolName: true, target: true },
    orderBy: { toolName: "asc" },
  })
  console.log(`\n=== 成功执行的工具 (${runs.length}) ===`)
  const byTool: Record<string, number> = {}
  for (const r of runs) {
    byTool[r.toolName] = (byTool[r.toolName] || 0) + 1
  }
  for (const [tool, count] of Object.entries(byTool).sort()) {
    console.log(`  ${tool}: ${count}次`)
  }

  await prisma.$disconnect()
}

main()
