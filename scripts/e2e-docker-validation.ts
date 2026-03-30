/**
 * Phase 16: Docker 靶场端到端编排验证脚本
 *
 * 对每个 Docker 靶场执行完整的编排闭环验证：
 *   1. 探测靶场可用性
 *   2. 创建项目并运行 executeProjectLocalValidation()
 *   3. 验证 assets/findings/evidence 持久化
 *   4. 生成汇总报告
 *
 * 用法:
 *   npx tsx scripts/e2e-docker-validation.ts
 */
import fs from "node:fs"
import path from "node:path"

import { listLocalLabs } from "@/lib/local-lab-catalog"
import { executeProjectLocalValidation } from "@/lib/orchestrator-service"
import { createStoredProject } from "@/lib/project-repository"
import { listStoredAssets } from "@/lib/asset-repository"
import { listStoredEvidence } from "@/lib/evidence-repository"
import { listStoredProjectFindings } from "@/lib/project-results-repository"
import { discoverAndRegisterMcpServers } from "@/lib/mcp-auto-discovery"

interface LabValidationResult {
  labId: string
  labName: string
  status: "online" | "offline" | "unknown"
  protocol: string
  validationStatus: "success" | "blocked" | "skipped" | "error"
  assetCount: number
  evidenceCount: number
  findingCount: number
  runCount: number
  errorMessage?: string
  durationMs: number
}

const OUTPUT_DIR = path.join(process.cwd(), "output", "docker-validation")

async function main() {
  console.log("=== Phase 16: Docker 靶场端到端编排验证 ===\n")

  // Discover MCP servers
  console.log("[1/4] 发现并注册 MCP 工具...")

  try {
    discoverAndRegisterMcpServers()
    console.log("  MCP 工具注册完成\n")
  } catch (error) {
    console.error("  MCP 工具注册失败:", error)
    console.log("  将使用回退策略继续\n")
  }

  // Probe all labs
  console.log("[2/4] 探测 Docker 靶场...")
  const labs = await listLocalLabs({ probe: true })

  for (const lab of labs) {
    const icon = lab.status === "online" ? "+" : "-"
    console.log(`  [${icon}] ${lab.name} (${lab.id}) — ${lab.status}: ${lab.statusNote}`)
  }

  console.log()

  const onlineLabs = labs.filter((lab) => lab.status === "online")
  console.log(`  在线靶场: ${onlineLabs.length}/${labs.length}\n`)

  if (onlineLabs.length === 0) {
    console.error("没有在线靶场，请先启动 Docker 靶场:")
    console.error("  docker compose -f docker/local-labs/compose.yaml up -d")
    process.exit(1)
  }

  // Run validation for each online lab
  console.log("[3/4] 执行编排闭环验证...\n")
  const results: LabValidationResult[] = []

  for (const lab of labs) {
    const startMs = Date.now()

    if (lab.status !== "online") {
      results.push({
        labId: lab.id,
        labName: lab.name,
        status: lab.status,
        protocol: lab.baseUrl.startsWith("tcp://") ? "tcp" : "http",
        validationStatus: "skipped",
        assetCount: 0,
        evidenceCount: 0,
        findingCount: 0,
        runCount: 0,
        durationMs: 0,
      })

      console.log(`  [SKIP] ${lab.name} — 离线\n`)
      continue
    }

    console.log(`  [RUN] ${lab.name} (${lab.baseUrl})...`)

    try {
      // Create a dedicated project for this lab
      const { project } = await createStoredProject({
        name: `Docker验证-${lab.name}`,
        description: `Phase 16 自动化验证：${lab.description}`,
        targetInput: lab.baseUrl,
      })

      // Execute local validation
      const payload = await executeProjectLocalValidation(project.id, {
        labId: lab.id,
        approvalScenario: "none",
      })

      const assetCount = (await listStoredAssets(project.id)).length
      const evidenceCount = (await listStoredEvidence(project.id)).length
      const findingCount = (await listStoredProjectFindings(project.id)).length
      const runCount = payload?.runs.length ?? 0

      results.push({
        labId: lab.id,
        labName: lab.name,
        status: "online",
        protocol: lab.baseUrl.startsWith("tcp://") ? "tcp" : "http",
        validationStatus: payload ? (payload.status === "blocked" ? "blocked" : "success") : "error",
        assetCount,
        evidenceCount,
        findingCount,
        runCount,
        durationMs: Date.now() - startMs,
      })

      console.log(`    -> runs=${runCount} assets=${assetCount} evidence=${evidenceCount} findings=${findingCount} (${Date.now() - startMs}ms)`)
    } catch (error) {
      results.push({
        labId: lab.id,
        labName: lab.name,
        status: "online",
        protocol: lab.baseUrl.startsWith("tcp://") ? "tcp" : "http",
        validationStatus: "error",
        assetCount: 0,
        evidenceCount: 0,
        findingCount: 0,
        runCount: 0,
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startMs,
      })

      console.log(`    -> ERROR: ${error instanceof Error ? error.message : error}`)
    }

    console.log()
  }

  // Generate summary report
  console.log("[4/4] 生成汇总报告...\n")
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const report = buildReport(results)
  const reportPath = path.join(OUTPUT_DIR, `validation-${new Date().toISOString().slice(0, 10)}.md`)
  fs.writeFileSync(reportPath, report, "utf-8")

  console.log(report)
  console.log(`\n报告已保存到: ${reportPath}`)
}

function buildReport(results: LabValidationResult[]): string {
  const total = results.length
  const success = results.filter((r) => r.validationStatus === "success").length
  const blocked = results.filter((r) => r.validationStatus === "blocked").length
  const skipped = results.filter((r) => r.validationStatus === "skipped").length
  const errors = results.filter((r) => r.validationStatus === "error").length
  const totalAssets = results.reduce((sum, r) => sum + r.assetCount, 0)
  const totalEvidence = results.reduce((sum, r) => sum + r.evidenceCount, 0)
  const totalFindings = results.reduce((sum, r) => sum + r.findingCount, 0)
  const totalRuns = results.reduce((sum, r) => sum + r.runCount, 0)

  const lines = [
    "# Docker 靶场编排验证报告",
    "",
    `日期: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "## 汇总",
    "",
    `| 指标 | 数值 |`,
    `|------|------|`,
    `| 总靶场数 | ${total} |`,
    `| 成功 | ${success} |`,
    `| 阻塞 | ${blocked} |`,
    `| 跳过(离线) | ${skipped} |`,
    `| 错误 | ${errors} |`,
    `| 总 MCP 运行 | ${totalRuns} |`,
    `| 总资产 | ${totalAssets} |`,
    `| 总证据 | ${totalEvidence} |`,
    `| 总发现 | ${totalFindings} |`,
    "",
    "## 靶场明细",
    "",
    "| 靶场 | 协议 | 状态 | 验证结果 | Runs | Assets | Evidence | Findings | 耗时 |",
    "|------|------|------|----------|------|--------|----------|----------|------|",
  ]

  for (const r of results) {
    const statusIcon = r.validationStatus === "success" ? "PASS" : r.validationStatus === "skipped" ? "SKIP" : r.validationStatus === "blocked" ? "BLOCK" : "FAIL"
    lines.push(
      `| ${r.labName} | ${r.protocol} | ${r.status} | ${statusIcon} | ${r.runCount} | ${r.assetCount} | ${r.evidenceCount} | ${r.findingCount} | ${r.durationMs}ms |`,
    )
  }

  if (errors > 0) {
    lines.push("", "## 错误详情", "")

    for (const r of results.filter((r) => r.validationStatus === "error")) {
      lines.push(`- **${r.labName}**: ${r.errorMessage ?? "未知错误"}`)
    }
  }

  return lines.join("\n")
}

main().catch((error) => {
  console.error("验证脚本异常退出:", error)
  process.exit(1)
})
